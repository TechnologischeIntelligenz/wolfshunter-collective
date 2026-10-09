import {
  askCollectiveAssistant,
  type AssistantResult,
} from "./openai-assistant.server";

export const BRAIN_ROLES = {
  operator_advisor: {
    label: "Operator-Berater",
    guidance:
      "Analysiere App-Zustand, Prioritäten, Datenflüsse, Releases und konkrete nächste Schritte. Trenne belegte Fakten, Vermutungen und offene Prüfungen.",
  },
  retailer_sales: {
    label: "Retailer-Verkaufsprofi",
    guidance:
      "Berate Händler zu Sortimentswahl, Positionierung, Conversion, Marge, Cross-Selling und sicherem DRAFT-Import. Erfinde keine Nachfrage-, Lager-, Lieferzeit- oder Margendaten.",
  },
  superadmin2: {
    label: "Superadmin 2 – Operator-Vertretung",
    guidance:
      "Denke systemweit über Shopify, Worker, Datenbank, Jobs, GitHub und Integrationen nach. Du bist nur beratend tätig; diese Rollenwahl erteilt keinerlei Berechtigungen und umgeht keine serverseitige Admin-Prüfung.",
  },
  security_officer: {
    label: "Sicherheitsbeauftragter",
    guidance:
      "Prüfe Least Privilege, Tenant-Trennung, Secrets, Authentifizierung, Backups, Auditierbarkeit und Wiederherstellbarkeit. Empfiehl sichere, reversible Schritte und melde Unsicherheiten explizit.",
  },
} as const;

export type BrainRole = keyof typeof BRAIN_ROLES;

const roleKeys = Object.keys(BRAIN_ROLES) as BrainRole[];

export function isBrainRole(value: unknown): value is BrainRole {
  return typeof value === "string" && roleKeys.includes(value as BrainRole);
}

export type BrainRequestClass = "advisory" | "approval_required";

const APPROVAL_REQUIRED_PATTERN =
  /\b(delete|delet(e|ion)|destroy|drop table|truncate|erase|lösch|entfern|refund|refun(d|dierung)|rückerstatt|auszahl|payout|payment|zahlung|publish|publication|veröffentlich|deploy|deployment|production|produkt.*(ändern|schreiben)|write[_ -]?shipping|write[_ -]?products|scope.*(ändern|erweitern)|token.*(rotate|rotation|wechsel)|credential|passwort|secret|api.?key|datenbank.?migration|customer.?data|kundendaten|bestell.*(ändern|stornieren))\b/i;

const SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bshpat_[A-Za-z0-9_-]{16,}\b/g,
  /\bshpss_[A-Za-z0-9_-]{16,}\b/g,
  /\bshpca_[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[A-Za-z0-9_-]{25,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(?:OPENAI_API_KEY|DEIN_NEUER_OPENAI_PROJECT_KEY|SHOPIFY_API_SECRET|CLOUDFLARE_API_TOKEN|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*[^\s,;]+/gi,
] as const;

export function redactBrainInput(value: string) {
  let safe = [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return typeof codePoint === "number" && (codePoint < 32 || codePoint === 127)
        ? " "
        : character;
    })
    .join("");

  for (const pattern of SECRET_PATTERNS) {
    safe = safe.replace(pattern, "[SECRET REDACTED]");
  }
  return safe.trim().slice(0, 3000);
}

export interface BrainControllerResult {
  ok: boolean;
  role: BrainRole;
  roleLabel: string;
  requestClass: BrainRequestClass;
  approvalRequired: boolean;
  execution: "not_executed";
  source: AssistantResult["source"];
  answer: string;
  model?: string;
  error?: string;
}

export async function askBrainController(input: {
  shop: string;
  role: BrainRole;
  message: string;
}): Promise<BrainControllerResult> {
  const message = redactBrainInput(input.message);
  const role = BRAIN_ROLES[input.role];
  const approvalRequired = APPROVAL_REQUIRED_PATTERN.test(message);

  if (!message) {
    return {
      ok: false,
      role: input.role,
      roleLabel: role.label,
      requestClass: "advisory",
      approvalRequired: false,
      execution: "not_executed",
      source: "local",
      answer: "Schreibe zuerst eine Frage oder Aufgabe.",
      error: "empty_message",
    };
  }

  const controllerPrompt = [
    "WOLFSHUNTER BRAIN CONTROLLER — Beratungsschicht für den authentifizierten App-Operator.",
    `Aktive Perspektive: ${role.label}.`,
    role.guidance,
    "Arbeitsregeln: Antworte auf Deutsch; nutze die übergebenen, shopbezogenen Live-/Wissensdaten; unterscheide Fakten, Hypothesen und fehlende Nachweise; liefere konkrete, priorisierte Schritte.",
    "Du hast in dieser Anfrage keine Ausführungswerkzeuge. Behaupte niemals, dass Code, Datenbank, Shopify, GitHub, Cloudflare, Zahlungen oder Einstellungen geändert wurden.",
    "Bei Produktionsänderungen, Schreiboperationen, Löschungen, Veröffentlichungen, Auth-/Scope-Änderungen, Finanzentscheidungen oder Datenmigrationen: nur einen Vorschlag mit Vorbedingungen, Preview/Backup, Prüfung und ausdrücklicher Freigabe formulieren.",
    "Beachte Datenisolation pro Shop. Gib niemals Tokens, API-Schlüssel, private Kundendaten oder Authentifizierungsdaten aus. Geheimnisähnliche Teile der Nutzereingabe wurden vor dem Versand redigiert.",
    "Gib die Antwort mit den Überschriften: Lagebild; Empfehlung; Risiko/Freigabe; Nächster überprüfbarer Schritt.",
    approvalRequired
      ? "SICHERHEITSGATE: Diese Anfrage kann einen produktiven oder sensiblen Eingriff betreffen. Nichts ausführen; Voraussetzungen, Backup/Preview und manuelle Freigabe klar benennen."
      : "SICHERHEITSGATE: Nur beratend antworten. Keine Nebenwirkungen auslösen.",
    "Aufgabe des Operators:",
    message,
  ].join("\n\n");

  try {
    const result = await askCollectiveAssistant({
      shop: input.shop,
      mode: "operations_analysis",
      message: controllerPrompt,
    });
    return {
      ok: result.ok,
      role: input.role,
      roleLabel: role.label,
      requestClass: approvalRequired ? "approval_required" : "advisory",
      approvalRequired,
      execution: "not_executed",
      source: result.source,
      answer: result.answer,
      ...(result.model ? { model: result.model } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
  } catch {
    return {
      ok: false,
      role: input.role,
      roleLabel: role.label,
      requestClass: approvalRequired ? "approval_required" : "advisory",
      approvalRequired,
      execution: "not_executed",
      source: "local",
      answer:
        "Der Live-Assistent ist gerade nicht erreichbar. Es wurde nichts ausgeführt. Prüfe zuerst App-/Datenbankstatus und Provider-Konfiguration; ändere keine Credentials blind.",
      error: "brain_unavailable",
    };
  }
}
