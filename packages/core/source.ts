import type { JobSource } from "./types.js";

const SOURCE_LABELS: Record<JobSource, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  gupy: "Gupy",
  remotar: "Remotar",
  meupadrinho: "Meu Padrinho",
  greenhouse: "Greenhouse",
  lever: "Lever",
  "company-site": "Site da empresa",
  unknown: "Fonte",
};

const SOURCE_EMOJIS: Record<JobSource, string> = {
  linkedin: "💼",
  indeed: "🔍",
  gupy: "💚",
  remotar: "🌐",
  meupadrinho: "🤝",
  greenhouse: "🌱",
  lever: "⚙️",
  "company-site": "🏢",
  unknown: "🔗",
};

const SOURCE_COLORS: Record<JobSource, string> = {
  linkedin: "#0A66C2",
  indeed: "#2557A7",
  gupy: "#10B981",
  remotar: "#3B82F6",
  meupadrinho: "#F59E0B",
  greenhouse: "#2E7D32",
  lever: "#6366F1",
  "company-site": "#475569",
  unknown: "#6366F1",
};

export function detectApplySourceFromUrl(url: string): JobSource {
  const normalized = String(url ?? "").toLowerCase();

  if (normalized.includes("gupy.io")) return "gupy";
  if (normalized.includes("linkedin.com")) return "linkedin";
  if (normalized.includes("indeed.com") || normalized.includes("indeed.com.br")) return "indeed";
  if (normalized.includes("remotar.com.br")) return "remotar";
  if (normalized.includes("meupadrinho.com.br")) return "meupadrinho";
  if (normalized.includes("greenhouse.io")) return "greenhouse";
  if (normalized.includes("lever.co")) return "lever";

  return "company-site";
}

export function getSourceLabel(source: JobSource | string | null | undefined): string {
  return SOURCE_LABELS[normalizeSource(source)] ?? SOURCE_LABELS.unknown;
}

export function getSourceEmoji(source: JobSource | string | null | undefined): string {
  return SOURCE_EMOJIS[normalizeSource(source)] ?? SOURCE_EMOJIS.unknown;
}

export function getSourceColor(source: JobSource | string | null | undefined): string {
  return SOURCE_COLORS[normalizeSource(source)] ?? SOURCE_COLORS.unknown;
}

export function normalizeSource(source: JobSource | string | null | undefined): JobSource {
  const value = String(source ?? "").toLowerCase();
  return value in SOURCE_LABELS ? (value as JobSource) : "unknown";
}
