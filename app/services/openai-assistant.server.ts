import OpenAI from "openai";

import { getAssistantKnowledge } from "./knowledge-sync.server";
import type { CatalogProduct } from "./merchandising/types";
import {
  getImportedProductPushes,
  getRetailerSettings,
} from "./retailer-commerce.server";
import { getRetailerWorkspace } from "./retailer-workspace.server";
import { getRetailerCatalogSnapshot } from "./shopify-source-catalog.server";

export type AssistantMode =
  | "technical_support"
  | "product_advice"
  | "returns_orders"
  | "merchant_support"
  | "operations_analysis";

const assistantModeValues: AssistantMode[] = [
  "technical_support",
  "product_advice",
  "returns_orders",
  "merchant_support",
  "operations_analysis",
];

export function isAssistantMode(value: unknown): value is AssistantMode {
  return typeof value === "string" && assistantModeValues.includes(value as AssistantMode);
}

interface AssistantContext {
  shop: string;
  catalogSource: "shopify" | "fallback";
  catalogCount: number;
  sourceProductCount: number;
  catalogError: string | null;
  knowledgeSource: "knowledge" | "live" | "empty";
  policyDocuments: Array<{
    title: string;
    body: string;
    metadata: string;
  }>;
  matchedProducts: Array<{
    id: string;
    title: string;
    category: string;
    collections: string[];
    price: number;
    currency: string;
    stock: number;
    deliveryDays: number | null;
    imageCount: number;
    description: string | null;
  }>;
  favoriteCount: number;
  importedCount: number;
  productPushes: Array<{
    title: string;
    status: string;
    error: string | null;
  }>;
  retailerSettings: {
    marketCountry: string;
    warehouse: string;
    marginPercent: number;
    requireApproval: boolean;
    automaticPublication: boolean;
  };
  policies: {
    productPublication: string;
    returns: string;
    tracking: string;
    dataSafety: string;
  };
}

export interface AssistantResult {
  ok: boolean;
  source: "openai" | "gemini" | "combined" | "local";
  answer: string;
  mode?: AssistantMode;
  model?: string;
  error?: string;
}

const normalizeOpenAiModelName = (value: string | undefined, fallback = "gpt-5") => {
  const configured = value?.trim();
  if (!configured) return fallback;
  if (/^gpt-5\.6-(terra|sol)$/i.test(configured)) return fallback;
  return configured;
};

const modelName = (mode: AssistantMode) => {
  if (mode === "operations_analysis") {
    return normalizeOpenAiModelName(
      process.env.OPENAI_ANALYSIS_MODEL?.trim() || process.env.OPENAI_MODEL,
      "gpt-5",
    );
  }

  return normalizeOpenAiModelName(process.env.OPENAI_MODEL, "gpt-5");
};

const geminiModelName = (mode: AssistantMode) => {
  if (mode === "operations_analysis") {
    return process.env.GEMINI_ANALYSIS_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash";
  }

  return process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash";
};

const openAiApiKey = () =>
  process.env.DEIN_NEUER_OPENAI_PROJECT_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();

const geminiApiKey = () => process.env.GEMINI_API_KEY?.trim();

const stripHtml = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const productSearchTokens = (message: string) => {
  const stopWords = new Set([
    "bitte",
    "kann",
    "kannst",
    "produkt",
    "produkte",
    "shopify",
    "wolfshunter",
    "collective",
    "hilfe",
    "import",
    "draft",
    "order",
    "tracking",
  ]);

  return [
    ...new Set(
      message
        .toLowerCase()
        .split(/[^a-z0-9äöüß]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !stopWords.has(token)),
    ),
  ];
};

const productSearchText = (product: CatalogProduct) =>
  `${product.title} ${product.category} ${product.collections
    .map((collection) => collection.title)
    .join(" ")} ${stripHtml(product.descriptionHtml)}`.toLowerCase();

function selectRelevantProducts(catalog: CatalogProduct[], message: string) {
  const tokens = productSearchTokens(message);
  const scored = catalog.map((product) => {
    const text = productSearchText(product);
    const tokenScore = tokens.reduce(
      (score, token) => score + (text.includes(token) ? 1 : 0),
      0,
    );
    const qualityScore =
      (product.primaryImageAvailable ? 0.3 : 0) +
      Math.min(product.imageCount, 6) * 0.05 +
      (product.availableToSell > 0 ? 0.2 : 0);
    return { product, score: tokenScore + qualityScore };
  });

  const ranked = scored
    .filter((entry) => (tokens.length ? entry.score >= 1 : true))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.product.availableToSell - left.product.availableToSell,
    )
    .slice(0, tokens.length ? 30 : 12);

  return ranked.map(({ product }) => ({
    id: product.id,
    title: product.title,
    category: product.category,
    collections: product.collections.map((collection) => collection.title).slice(0, 8),
    price: product.recommendedRetailPrice,
    currency: product.currency,
    stock: product.availableToSell,
    deliveryDays: product.estimatedDeliveryDays,
    imageCount: product.imageCount,
    description: stripHtml(product.descriptionHtml).slice(0, 360) || null,
  }));
}

async function requestGemini({
  apiKey,
  mode,
  input,
}: {
  apiKey: string;
  mode: AssistantMode;
  input: string;
}) {
  const gemini = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    timeout: 15000,
  });
  const response = await gemini.chat.completions.create({
    model: geminiModelName(mode),
    messages: [
      { role: "system", content: instructions(mode) },
      { role: "user", content: input },
    ],
    max_tokens: 900,
  });

  const content = response.choices[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

export async function getAssistantContext(
  shop: string,
  message = "",
): Promise<AssistantContext> {
  const [workspace, settings, pushes] = await Promise.all([
    getRetailerWorkspace(shop),
    getRetailerSettings(shop),
    getImportedProductPushes(shop),
  ]);
  const knowledge = await getAssistantKnowledge(message);
  const catalogSnapshot =
    knowledge.productCount > 0
      ? null
      : await getRetailerCatalogSnapshot(shop, settings);

  return {
    shop,
    catalogSource: catalogSnapshot?.source ?? "shopify",
    catalogCount: knowledge.productCount || catalogSnapshot?.catalog.length || 0,
    sourceProductCount:
      knowledge.sourceProductCount || catalogSnapshot?.sourceProductCount || 0,
    catalogError: catalogSnapshot?.error ?? null,
    knowledgeSource:
      knowledge.productCount > 0 ? "knowledge" : catalogSnapshot ? "live" : "empty",
    policyDocuments: knowledge.policyDocuments,
    matchedProducts:
      knowledge.productCount > 0
        ? knowledge.matchedProducts
        : selectRelevantProducts(catalogSnapshot?.catalog ?? [], message),
    favoriteCount: workspace.favoriteProductIds.length,
    importedCount: workspace.importedProductIds.length,
    productPushes: pushes.slice(0, 10).map((push) => ({
      title: push.sourceTitle,
      status: push.status,
      error: push.errorMessage,
    })),
    retailerSettings: {
      marketCountry: settings.marketCountry,
      warehouse: settings.warehouse,
      marginPercent: settings.marginPercent,
      requireApproval: settings.requireApproval,
      automaticPublication: settings.autoPublish,
    },
    policies: {
      productPublication:
        "Retailer imports create unpublished Shopify DRAFT products only. Publication requires manual merchant review in Shopify.",
      returns:
        "Return and refund decisions must follow the retailer's own Shopify store policy, order record, supplier terms, and human review. The assistant may explain policy and collect order context, but must not approve refunds or payment changes automatically.",
      tracking:
        "Tracking is read from Shopify order fulfillments and carrier tracking URLs when present. 17TRACK can be added as an optional provider after the shop owner installs/authorizes it or provides an API account.",
      dataSafety:
        "Do not request or reveal secrets, full tokens, private customer data, payment details, or external app credentials.",
    },
  };
}

const fallbackAnswer = (message: string, context: AssistantContext, mode: AssistantMode) => {
  const normalized = message.toLowerCase();
  const codeMatch = message.match(/\b(401|403|404|409|422|429|500|501|502|503)\b/);

  if (mode === "technical_support" && codeMatch?.[1] === "401") {
    return "401 bedeutet hier fast immer Authentifizierung: Shopify-Session, App-URL, Client-ID/Secret oder abgelaufener Login passen nicht zusammen. Öffne die App aus dem Shopify-Admin erneut, prüfe danach zuerst /healthz und installiere die App nicht vorschnell neu. Tokens gehören niemals in den Chat.";
  }
  if (mode === "technical_support" && codeMatch?.[1] === "403") {
    return "403 bedeutet Berechtigung oder Cloudflare Access. Prüfe die Access-Policy für collective.wolfshunter.com und ob die Anfrage an die richtige Route geht. Die Händler-App darf dadurch nicht pauschal App-Admin-Rechte erhalten.";
  }
  if (mode === "technical_support" && codeMatch?.[1] === "404") {
    return "404 bedeutet: Diese URL ist auf dem angesprochenen Dienst nicht registriert. Prüfe zuerst Hostname, Pfad und ob Shopify eine interne Prüfroute wie /extensions aufruft. /healthz ist der sichere öffentliche Erreichbarkeitstest; erst danach die geschützte /app-Route testen.";
  }
  if (mode === "technical_support" && codeMatch?.[1] === "501") {
    return "501 bedeutet nicht implementiert. Das ist kein Grund, Daten zu löschen: Funktion als geplante, approval-gated Verbesserung markieren, erst den Scope definieren und dann mit einer reversiblen DRAFT-/Preview-Aktion ergänzen.";
  }
  if (mode === "technical_support" && codeMatch) {
    return `${codeMatch[1]} ist ein technischer Fehlerstatus. Nenne URL, letzte Aktion und Zeitpunkt; prüfe zuerst /healthz und ändere keine Tokens oder Cloudflare-Regeln.`;
  }
  if (mode === "product_advice" || normalized.includes("import") || normalized.includes("produkt")) {
    const matches = context.matchedProducts
      .slice(0, 5)
      .map(
        (product) =>
          `${product.title} (${product.category}, ${product.price.toFixed(2)} ${product.currency})`,
      )
      .join("; ");
    return `Der aktuelle Händler-Workspace sieht ${context.catalogCount} Katalogprodukt(e) aus ${context.catalogSource === "shopify" ? "Shopify live" : "sicherer Vorschau"} und enthält ${context.importedCount} importierte Auswahl(en). ${matches ? `Relevante Treffer: ${matches}. ` : ""}Nutze Import Lists und erstelle dort je Produkt ausdrücklich einen Shopify-DRAFT; automatische Veröffentlichung bleibt deaktiviert.`;
  }
  if (mode === "returns_orders") {
    return "Retouren und Tracking müssen an Bestellnummer, Shopify-Fulfillment und die Händler-Rückgaberichtlinie gebunden sein. Bitte nenne Bestellnummer, Trackingnummer oder Status; ich kann den Fall einordnen, aber keine Rückerstattung, Löschung oder Bestellung eigenständig ausführen.";
  }
  if (mode === "merchant_support") {
    return `Der Händler-Workspace ist für ${context.shop} abgegrenzt. Aktuell sind ${context.importedCount} Auswahl(en) importiert; Freigabe ist ${context.retailerSettings.requireApproval ? "aktiv" : "nicht aktiv"}, automatische Veröffentlichung bleibt jedoch sicher deaktiviert. Ich kann Einstellungen, Katalogsuche, Tracking und nächste Händler-Schritte erklären.`;
  }

  return "Ich kann die aktuelle App lokal weiter diagnostizieren. Nenne mir Statuscode, URL und was du unmittelbar davor geklickt hast; ich ordne den Fehler ein und schlage nur reversible nächste Schritte vor.";
};

const ethicalGuardrails = `
Ethics and fairness: never declare guilt or fraud from a score, origin, language, category, region, protected characteristic, or other weak proxy. Give evidence, uncertainty, and a fair next review step.
Adverse actions such as bans, refunds, damages decisions, contract termination, withholding money, or payout changes require human review, a reason, and an appeal path.
Emergency balance protection is allowed only when a partner's missed deadline or broken agreement is evidenced and a pre-approved policy permits a reversible, least-invasive safeguard. Record the evidence, deadline, affected orders, notification, and reversal path.
Transparency: state prices, shares, fees, status, data sources, uncertainty, and AI use openly. Never redirect or withhold money outside a confirmed agreement.
`;

const instructions = (mode: AssistantMode) => `
${ethicalGuardrails}
Du bist der sichere WOLFSHUNTER COLLECTIVE ${mode === "operations_analysis" ? "Operations-Analyseassistent" : "Supportassistent"} im Modus ${mode}.
Antworte standardmäßig auf Deutsch, klar und kurz.
Du darfst nur mit den gelieferten, shopbezogenen Betriebsdaten arbeiten. Erfinde keine Shopify-Daten, Preise, Bestellungen, Trackingereignisse, Rückgaberegeln, Zugriffsrechte oder Erfolgszustände.
Produktwissen kommt aus liveContext.catalogCount und liveContext.matchedProducts. Wenn ein Produkt nicht in matchedProducts liegt, erkläre, dass du gezielt nach Titel/Kategorie/Collection suchen kannst, statt Details zu erfinden.
Rückgaben, Retouren, Ersatzlieferungen und Tracking müssen anhand von liveContext.policies und vorhandenen Shopify-Daten erklärt werden. Keine automatische Genehmigung, keine Zahlungsentscheidung, keine Garantiezusage.
Modusregeln: technical_support erklärt technische Statuscodes und Auth-Flows; product_advice berät zu Katalog, Import-Liste und DRAFT-Produkten; returns_orders behandelt Rückgaben, Tracking und Bestellfragen, weist aber fehlende Live-Bestelldaten offen aus; merchant_support erklärt Händler-Workspace, Settings, Freigaben und sichere Abläufe; operations_analysis fasst belegte Betriebsdaten für den Betreiber zusammen.
Behandle 401, 403, 404, 409, 422, 429, 500, 501, 502 und 503 unterschiedlich und gib immer Diagnose, sichere nächste Aktion und einen Hinweis, was nicht getan werden soll.
Du darfst niemals Geheimnisse anfordern oder ausgeben. Du darfst keine Cloudflare-Regel, Shopify-Einstellung, Produktveröffentlichung, Löschung, Tokenrotation, Rückerstattung, Tracking-App-Installation oder Bestellung eigenständig ausführen.
Produktaktionen bleiben approval-gated: Import List -> expliziter Shopify-DRAFT. Veröffentlichung ist nicht Teil dieses Assistenten.
Wenn Daten fehlen, sage das offen. Bei Unsicherheit: erst prüfen, nicht raten.
`;

export async function askCollectiveAssistant({
  shop,
  message,
  mode = "technical_support",
}: {
  shop: string;
  message: string;
  mode?: AssistantMode;
}): Promise<AssistantResult> {
  const context = await getAssistantContext(shop, message);
  const localAnswer = fallbackAnswer(message, context, mode);
  const apiKey = openAiApiKey();
  const secondaryApiKey = geminiApiKey();
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const provider = configuredProvider === "openai" || configuredProvider === "gemini"
    ? configuredProvider
    : "auto";
  const input = JSON.stringify({
    userMessage: message.slice(0, 4000),
    liveContext: context,
    localDiagnosticBaseline: localAnswer,
  });
  let geminiAutoAttempted = false;

  if (provider === "gemini") {
    if (!secondaryApiKey) {
      return {
        ok: true,
        source: "local",
        answer: `${localAnswer}\n\nGemini ist ausgewählt, aber GEMINI_API_KEY fehlt; lokale Diagnosehilfe bleibt aktiv.`,
        mode,
        error: "Gemini API key missing",
      };
    }

    try {
      const answer = await requestGemini({ apiKey: secondaryApiKey, mode, input });
      return answer
        ? { ok: true, source: "gemini", answer, mode, model: geminiModelName(mode) }
        : { ok: true, source: "local", answer: localAnswer, mode };
    } catch (error) {
      const apiError = error as { status?: number; code?: string; type?: string };
      console.error("[collective-assistant] Gemini request failed", {
        status: apiError.status ?? null,
        code: apiError.code ?? null,
        type: apiError.type ?? null,
      });
      return {
        ok: true,
        source: "local",
        answer: `${localAnswer}\n\nGemini ist momentan nicht erreichbar; die lokale Diagnosehilfe bleibt aktiv.`,
        mode,
        error: "Gemini request failed",
      };
    }
  }

  if (provider === "auto" && mode === "product_advice" && secondaryApiKey) {
    geminiAutoAttempted = true;
    try {
      const answer = await requestGemini({ apiKey: secondaryApiKey, mode, input });
      if (answer) {
        return { ok: true, source: "gemini", answer, mode, model: geminiModelName(mode) };
      }
    } catch (error) {
      const apiError = error as { status?: number; code?: string; type?: string };
      console.error("[collective-assistant] Gemini product route failed", {
        status: apiError.status ?? null,
        code: apiError.code ?? null,
        type: apiError.type ?? null,
      });
    }
  }

  if (!apiKey) {
    if (provider === "auto" && secondaryApiKey && !geminiAutoAttempted) {
      try {
        const answer = await requestGemini({ apiKey: secondaryApiKey, mode, input });
        return answer
          ? { ok: true, source: "gemini", answer, mode, model: geminiModelName(mode) }
          : { ok: true, source: "local", answer: localAnswer, mode };
      } catch (error) {
        const apiError = error as { status?: number; code?: string; type?: string };
        console.error("[collective-assistant] Gemini request failed", {
          status: apiError.status ?? null,
          code: apiError.code ?? null,
          type: apiError.type ?? null,
        });
      }
    }

    return { ok: true, source: "local", answer: localAnswer, mode };
  }

  try {
    const openai = new OpenAI({ apiKey, timeout: 15000 });
    const response = await openai.responses.create({
      model: modelName(mode),
      store: false,
      instructions: instructions(mode),
      input,
      max_output_tokens: 900,
    });
    const answer = response.output_text?.trim() ?? "";
    if (!answer) {
      return { ok: true, source: "local", answer: localAnswer, mode };
    }

    return { ok: true, source: "openai", answer, mode, model: modelName(mode) };
  } catch (error) {
    const apiError = error as {
      status?: number;
      code?: string;
      type?: string;
      param?: string | null;
    };
    console.error("[collective-assistant] OpenAI request failed", {
      status: apiError.status ?? null,
      code: apiError.code ?? null,
      type: apiError.type ?? null,
      param: apiError.param ?? null,
    });

    if (provider === "auto" && secondaryApiKey && !geminiAutoAttempted) {
      try {
        const answer = await requestGemini({ apiKey: secondaryApiKey, mode, input });
        if (answer) {
          return { ok: true, source: "gemini", answer, mode, model: geminiModelName(mode) };
        }
      } catch (fallbackError) {
        const fallbackApiError = fallbackError as { status?: number; code?: string; type?: string };
        console.error("[collective-assistant] Gemini fallback failed", {
          status: fallbackApiError.status ?? null,
          code: fallbackApiError.code ?? null,
          type: fallbackApiError.type ?? null,
        });
      }
    }

    return {
      ok: true,
      source: "local",
      answer: `${localAnswer}\n\nOpenAI ist momentan nicht erreichbar; die lokale Diagnosehilfe bleibt aktiv.`,
      mode,
      error: "OpenAI request failed",
    };
  }
}
