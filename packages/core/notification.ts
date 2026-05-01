import type { JobDTO, JobLanguage, JobSource, Seniority, WorkMode } from "./types.js";
import {
  detectApplySourceFromUrl,
  getSourceColor,
  getSourceEmoji,
  getSourceLabel,
} from "./source.js";

export type NotificationJob = {
  title: string;
  company: string;
  url: string;
  source: JobSource;
  sourceLabel: string;
  sourceEmoji: string;
  sourceColor: string;
  locationLabel?: string;
  workMode: WorkMode;
  workModeLabel?: string;
  workModeEmoji?: string;
  seniority: Seniority;
  seniorityLabel?: string;
  seniorityEmoji?: string;
  salaryLabel?: string;
  stackLabels: string[];
  requirementBullets: string[];
  summary?: string;
  language: JobLanguage;
  isInternational: boolean;
  internationalLabel?: string;
  publishedAtLabel?: string;
  scrapedAtLabel?: string;
};

const STACK_LABELS: Array<[string, string, RegExp]> = [
  ["react", "React", /\breact\b/i],
  ["angular", "Angular", /\bangular\b/i],
  ["vue", "Vue", /\bvue\.?js?\b|\bvuejs\b/i],
  ["next.js", "Next.js", /\bnext\.?js\b/i],
  ["node", "Node.js", /\bnode(?:\.js)?\b/i],
  ["python", "Python", /\bpython\b/i],
  ["java", "Java", /\bjava\b|spring boot|\bspring\b/i],
  ["javascript", "JavaScript", /\bjavascript\b|\bjs\b/i],
  ["typescript", "TypeScript", /\btypescript\b|\bts\b/i],
  ["kotlin", "Kotlin", /\bkotlin\b/i],
  ["swift", "Swift", /\bswift\b/i],
  ["flutter", "Flutter", /\bflutter\b|\bdart\b/i],
  ["c#", "C#", /\bc#\b/i],
  [".net", ".NET", /\.net|dotnet/i],
  ["php", "PHP", /\bphp\b|laravel/i],
  ["ruby", "Ruby", /\bruby\b|rails/i],
  ["go", "Go", /\bgolang\b|\bgo (developer|backend|lang)\b/i],
  ["rust", "Rust", /\brust\b/i],
  ["aws", "AWS", /\baws\b/i],
  ["azure", "Azure", /\bazure\b/i],
  ["gcp", "GCP", /\bgcp\b|google cloud/i],
  ["cloud", "Cloud", /\bcloud\b|aws|azure|gcp/i],
  ["docker", "Docker", /\bdocker\b/i],
  ["kubernetes", "Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["terraform", "Terraform", /\bterraform\b|\biac\b/i],
  ["sql", "SQL", /\bsql\b|postgres|mysql|oracle/i],
  ["nosql", "NoSQL", /\bnosql\b|mongodb|\bmongo\b|dynamodb|cassandra/i],
  ["redis", "Redis", /\bredis\b/i],
  ["kafka", "Kafka", /\bkafka\b|rabbitmq/i],
  ["graphql", "GraphQL", /\bgraphql\b/i],
  ["api", "APIs", /\bapis?\b|desenvolvimento de apis?|\brest\b/i],
  ["git", "Git", /\bgit\b/i],
  ["cypress", "Cypress", /\bcypress\b/i],
  ["selenium", "Selenium", /\bselenium\b/i],
  ["testing", "Testing", /\btesting\b|testes?|orientado a testes/i],
  ["web-scraping", "Web Scraping", /web scraping|scraping/i],
  ["fullstack", "Fullstack", /full[- ]?stack|fullstack/i],
  ["frontend", "Frontend", /front[- ]?end|frontend/i],
  ["backend", "Backend", /back[- ]?end|backend/i],
  ["data", "Dados", /\bdados\b|\bdata\b|analytics|data science|engenharia de dados/i],
  ["bi", "BI", /\bbi\b|business intelligence|power ?bi/i],
  ["ai", "AI/ML", /\bia\b|\bai\b|intelig[eê]ncia artificial|machine learning|\bml\b|\bllm\b|\bgpt\b/i],
  ["elasticsearch", "Elasticsearch", /elasticsearch|\belastic\b|\belk\b/i],
  ["figma", "Figma", /\bfigma\b/i],
  ["ux", "UX", /\bux\b|ux\/ui|ui\/ux|designer ux/i],
  ["ui", "UI", /\bui\b|ux\/ui|ui\/ux|designer ui/i],
  ["devops", "DevOps", /\bdevops\b/i],
  ["sre", "SRE", /\bsre\b/i],
  ["cybersecurity", "Cybersecurity", /cyber ?security|ciberseguran[cç]a|seguran[cç]a da informa[cç][aã]o|csirt|soc|blue team/i],
  ["siem", "SIEM", /\bsiem\b/i],
  ["soar", "SOAR", /\bsoar\b/i],
  ["edr", "EDR", /\bedr\b/i],
  ["ndr", "NDR", /\bndr\b/i],
  ["xdr", "XDR", /\bxdr\b/i],
  ["ips", "IPS", /\bips\b/i],
  ["waf", "WAF", /\bwaf\b/i],
  ["anti-ddos", "Anti-DDoS", /anti[- ]?ddos|ddos/i],
  ["nist", "NIST", /\bnist\b/i],
  ["sans", "SANS", /\bsans\b/i],
  ["iso-27001", "ISO 27001", /iso\/iec 27001|iso 27001|27001\/27035/i],
];

const STACK_ALIASES = new Map(
  STACK_LABELS.flatMap(([key, label]) => [
    [key, label],
    [label.toLowerCase(), label],
    [label.toLowerCase().replace(/[.#]/g, ""), label],
  ]),
);

const WORK_MODE: Record<WorkMode, { label?: string; emoji?: string }> = {
  remote: { label: "Remoto", emoji: "🌍" },
  hybrid: { label: "Híbrido", emoji: "🏠" },
  onsite: { label: "Presencial", emoji: "🏢" },
  unknown: { },
};

const SENIORITY: Record<Seniority, { label?: string; emoji?: string }> = {
  intern: { label: "Estágio", emoji: "🎓" },
  junior: { label: "Júnior", emoji: "🌱" },
  mid: { label: "Pleno", emoji: "💼" },
  senior: { label: "Sênior", emoji: "⭐" },
  specialist: { label: "Especialista", emoji: "🏆" },
  lead: { label: "Lead", emoji: "🧭" },
  unknown: {},
};

const LANGUAGE_HINTS: Array<[JobLanguage, RegExp]> = [
  ["pt", /\b(você|voce|gradua[cç][aã]o|ci[eê]ncia|seguran[cç]a|informa[cç][aã]o|experi[eê]ncia|conhecimento|requisitos e qualifica[cç][oõ]es|trabalho|remoto|h[ií]brido|benef[ií]cios|ingl[eê]s t[eé]cnico)\b/i],
  ["en", /\b(the|and|with|remote|requirements|experience|skills|team|software|engineer)\b/i],
  ["es", /\b(desarrollador|desarrolladora|equipo|conocimientos|experiencia|trabajo remoto)\b/i],
  ["fr", /\b(le|la|les|avec|exigences|expérience|équipe|logiciel)\b/i],
  ["de", /\b(und|mit|anforderungen|erfahrung|team|software)\b/i],
  ["it", /\b(il|la|con|requisiti|esperienza|squadra|software)\b/i],
];

export function cleanNotificationText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\n/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/(SQL)(APIs?)/gi, "$1 $2")
    .replace(/\bNode\s*\.\s*js\b/gi, "Node.js")
    .replace(/\bType\s*Script\b/gi, "TypeScript")
    .replace(/\bJava\s*Script\b/gi, "JavaScript")
    .replace(/\bPostgre\s*SQL\b/gi, "PostgreSQL")
    .replace(/\bMongo\s*DB\b/gi, "MongoDB")
    .replace(/\bDynamo\s*DB\b/gi, "DynamoDB")
    .replace(/\bSaa\s*S\b/gi, "SaaS")
    .replace(/\bi\s*Paa\s*S\b/gi, "iPaaS")
    .replace(/\bDev\s*Ops\b/gi, "DevOps")
    .replace(/\bService\s*Now\b/gi, "ServiceNow")
    .replace(/([a-zá-ú0-9])([A-ZÁ-Ú])/g, "$1 $2")
    .replace(/(?<!\d)\.(?=\S)/g, ". ")
    .replace(/([!?])(?=\S)/g, "$1 ")
    .replace(/\b([A-Za-zÀ-ÿ]+)\s*\.\s+(uol|ai)\b/gi, "$1.$2")
    .replace(/\bNode\s*\.\s*js\b/gi, "Node.js")
    .replace(/\bType\s*Script\b/gi, "TypeScript")
    .replace(/\bJava\s*Script\b/gi, "JavaScript")
    .replace(/\bPostgre\s*SQL\b/gi, "PostgreSQL")
    .replace(/\bMongo\s*DB\b/gi, "MongoDB")
    .replace(/\bDynamo\s*DB\b/gi, "DynamoDB")
    .replace(/\bSaa\s*S\b/gi, "SaaS")
    .replace(/\bi\s*Paa\s*S\b/gi, "iPaaS")
    .replace(/\bDev\s*Ops\b/gi, "DevOps")
    .replace(/\bService\s*Now\b/gi, "ServiceNow")
    .replace(/\be\s*\.\s*NET\b/gi, "e .NET")
    .replace(/\bDDo\s+S\b/g, "DDoS")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeNotificationText(value: unknown, maxLength = 280): string {
  let text = cleanNotificationText(value)
    .replace(/^(sobre a vaga|descri[cç][aã]o da vaga|responsabilidades(?: e atribui[cç][oõ]es)?|requisitos e qualifica[cç][oõ]es)\s*:?\s*/i, "")
    .trim();

  const sectionStop = text.search(/\b(requisitos(?: e qualifica[cç][oõ]es)?|requirements|qualifications|benef[ií]cios|benefits)\b/i);
  if (sectionStop > 80) {
    text = text.slice(0, sectionStop).trim();
  }

  if (!text || /^(sobre a vaga|responsabilidades|requisitos)/i.test(text)) return "";
  if (text.length <= maxLength) return text;

  const slice = text.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd >= 80) return slice.slice(0, sentenceEnd + 1).trim();

  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxLength).trim()}...`;
}

export function extractRequirementBullets(description: unknown, limit = 5): string[] {
  const text = cleanNotificationText(description);
  const match = text.match(/(?:requisitos(?: e qualifica[cç][oõ]es)?|qualifica[cç][oõ]es|requirements|qualifications|o que voc[eê] precisa ter|o que buscamos|what we look for)\s*:?\s*/i);
  if (!match?.index && match?.index !== 0) return [];

  const start = match.index + match[0].length;
  let block = text.slice(start);
  const stop = block.search(/\b(ser[aá] um diferencial|diferenciais|desej[aá]veis|benef[ií]cios|benefits|sobre a empresa|additional information|responsabilidades|remunera[cç][aã]o|sal[aá]rio)\b/i);
  if (stop >= 0) block = block.slice(0, stop);

  return block
    .split(/[•\n;]|(?:^|\s)-\s+|(?<=\.)\s+/)
    .map((line) => cleanNotificationText(line).replace(/^[-*:]\s*/, "").replace(/[.;]$/, "").trim())
    .filter((line) => line.length > 2)
    .filter((line) => !/^o que (voc[eê]|voce) precisa ter/i.test(line))
    .slice(0, limit);
}

export function extractStackLabels(description: unknown, existingStacks: string[] = [], limit = 16): string[] {
  const text = cleanNotificationText(description);
  const found = new Map<string, string>();
  const existingOrder: string[] = [];

  for (const stack of existingStacks ?? []) {
    const normalized = String(stack).trim().toLowerCase();
    const label = STACK_ALIASES.get(normalized) ?? STACK_ALIASES.get(normalized.replace(/[.#]/g, "")) ?? String(stack).trim();
    if (label && !found.has(label.toLowerCase())) {
      found.set(label.toLowerCase(), label);
      existingOrder.push(label.toLowerCase());
    }
  }

  for (const [key, label, pattern] of STACK_LABELS) {
    if (pattern.test(text) || found.has(key)) {
      found.set(label.toLowerCase(), label);
    }
  }

  return [...found.values()]
    .sort((a, b) => {
      const aExisting = existingOrder.indexOf(a.toLowerCase());
      const bExisting = existingOrder.indexOf(b.toLowerCase());
      if (aExisting !== -1 || bExisting !== -1) {
        return (aExisting === -1 ? Number.MAX_SAFE_INTEGER : aExisting) - (bExisting === -1 ? Number.MAX_SAFE_INTEGER : bExisting);
      }
      const aIndex = STACK_LABELS.findIndex(([, label]) => label === a);
      const bIndex = STACK_LABELS.findIndex(([, label]) => label === b);
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    })
    .slice(0, limit);
}

export function detectNotificationLanguage(text: unknown): JobLanguage {
  const value = cleanNotificationText(text);
  if (!value) return "unknown";
  for (const [language, pattern] of LANGUAGE_HINTS) {
    if (pattern.test(value)) return language;
  }
  return "unknown";
}

export function formatDateLabel(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildNotificationJob(job: JobDTO): NotificationJob {
  const source = detectApplySourceFromUrl(job.url);
  const workMode = WORK_MODE[job.workMode] ?? WORK_MODE.unknown;
  const seniority = SENIORITY[job.seniority] ?? SENIORITY.unknown;
  const language = job.language ?? detectNotificationLanguage(`${job.title} ${job.description ?? ""}`);
  const isInternational = job.isInternational ?? !["pt", "unknown"].includes(language);
  const summary = summarizeNotificationText(job.summary ?? job.description, 280);

  return {
    title: cleanNotificationText(job.title),
    company: cleanNotificationText(job.company || "Empresa não informada"),
    url: job.url,
    source,
    sourceLabel: getSourceLabel(source),
    sourceEmoji: getSourceEmoji(source),
    sourceColor: getSourceColor(source),
    locationLabel: cleanNotificationText(job.location),
    workMode: job.workMode,
    workModeLabel: workMode.label,
    workModeEmoji: workMode.emoji,
    seniority: job.seniority,
    seniorityLabel: seniority.label,
    seniorityEmoji: seniority.emoji,
    salaryLabel: cleanNotificationText(job.salaryText) || undefined,
    stackLabels: extractStackLabels(job.description, job.stack, 16),
    requirementBullets: extractRequirementBullets(job.description, 5),
    summary: summary || undefined,
    language,
    isInternational,
    internationalLabel: isInternational ? "🌎 Vaga internacional" : undefined,
    publishedAtLabel: formatDateLabel(job.publishedAt),
    scrapedAtLabel: formatDateLabel(job.scrapedAt),
  };
}
