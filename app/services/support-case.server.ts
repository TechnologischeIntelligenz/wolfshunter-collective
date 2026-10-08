import db from "../db.server";
import type {
  AssistantMode,
  AssistantResult,
} from "./openai-assistant.server";
import { sanitizeSupportMessage } from "./support-case-sanitizer";

const retentionDays = () => {
  const configured = Number(process.env.SUPPORT_CASE_RETENTION_DAYS ?? "90");
  return Number.isFinite(configured)
    ? Math.min(365, Math.max(7, Math.round(configured)))
    : 90;
};

export interface AdminSupportInsights {
  total: number;
  needsAttention: number;
  liveAiAnswers: number;
  fallbackAnswers: number;
  latest: Array<{
    id: number;
    shop: string;
    mode: string;
    message: string;
    messagePreview: string;
    answer: string;
    status: string;
    source: string;
    model: string | null;
    errorCode: string | null;
    createdAt: string;
  }>;
}

export async function recordSupportCase(input: {
  shop: string;
  mode: AssistantMode;
  message: string;
  result: AssistantResult;
}) {
  const cutoff = new Date(Date.now() - retentionDays() * 86_400_000);
  await db.supportCase.deleteMany({ where: { createdAt: { lt: cutoff } } });

  const preview = sanitizeSupportMessage(input.message) || "[empty after redaction]";
  const answer = sanitizeSupportMessage(input.result.answer) || "[empty answer]";
  const status = input.result.error ? "NEEDS_ATTENTION" : "ANSWERED";

  return db.supportCase.create({
    data: {
      shop: input.shop,
      mode: input.mode,
      message: preview,
      messagePreview: preview,
      answer,
      status,
      source: input.result.source,
      model: input.result.model ?? null,
      errorCode: input.result.error ?? null,
    },
  });
}

export async function getAdminSupportInsights(): Promise<AdminSupportInsights> {
  const [total, needsAttention, liveAiAnswers, fallbackAnswers, latest] =
    await Promise.all([
      db.supportCase.count(),
      db.supportCase.count({ where: { status: "NEEDS_ATTENTION" } }),
      db.supportCase.count({ where: { source: { in: ["openai", "gemini"] } } }),
      db.supportCase.count({ where: { source: "local" } }),
      db.supportCase.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    ]);

  return {
    total,
    needsAttention,
    liveAiAnswers,
    fallbackAnswers,
    latest: latest.map((supportCase) => ({
      id: supportCase.id,
      shop: supportCase.shop,
      mode: supportCase.mode,
      messagePreview: supportCase.messagePreview,
      message: supportCase.message,
      answer: supportCase.answer,
      status: supportCase.status,
      source: supportCase.source,
      model: supportCase.model,
      errorCode: supportCase.errorCode,
      createdAt: supportCase.createdAt.toISOString(),
    })),
  };
}
