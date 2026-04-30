import * as cheerio from "cheerio";
import type { Seniority, WorkMode } from "./types.js";

const STACK_PATTERNS: Array<[string, RegExp]> = [
  ["qa", /\bq\.?a\.?\b|quality assurance|testes? de software|testes? de sistemas|automatizador de testes|test automation/i],
  ["javascript", /javascript|\bjs\b/i],
  ["typescript", /typescript|\bts\b/i],
  ["react", /react/i],
  ["node", /node\.?js|\bnode\b/i],
  ["java", /\bjava\b|spring boot|spring\b/i],
  ["kotlin", /kotlin/i],
  ["c#", /\bc#\b|\.net|dotnet/i],
  ["python", /python|django|fastapi/i],
  ["php", /\bphp\b|laravel/i],
  ["ruby", /ruby|rails/i],
  ["go", /\bgolang\b|\bgo\b/i],
  ["c++", /\bc\+\+\b/i],
  ["frontend", /front[- ]?end|frontend/i],
  ["backend", /back[- ]?end|backend/i],
  ["fullstack", /full[- ]?stack|fullstack/i],
  ["mobile", /\bmobile\b|android|\bios\b/i],
  ["android", /android/i],
  ["ios", /\bios\b/i],
  ["devops", /devops/i],
  ["sre", /\bsre\b/i],
  ["cloud", /\bcloud\b|aws|azure|gcp/i],
  ["aws", /\baws\b/i],
  ["azure", /\bazure\b/i],
  ["gcp", /\bgcp\b|google cloud/i],
  ["docker", /docker/i],
  ["kubernetes", /kubernetes|\bk8s\b/i],
  ["sql", /\bsql\b|postgres|mysql|oracle/i],
  ["api", /\bapis?\b|desenvolvimento de apis?/i],
  ["git", /\bgit\b/i],
  ["asyncio", /\basyncio\b|ass[ií]ncrono|concorrente/i],
  ["testing", /\btesting\b|testes?|orientado a testes/i],
  ["web-scraping", /web scraping|scraping/i],
  ["data", /\bdados\b|\bdata\b|analytics|data science|ci[eê]ncia de dados|engenharia de dados/i],
  ["bi", /\bbi\b|business intelligence|power ?bi/i],
  ["ai", /\bia\b|\bai\b|intelig[eê]ncia artificial|machine learning|\bml\b/i],
  ["cybersecurity", /cyber|seguran[cç]a da informa[cç][aã]o|seguran[cç]a cibern[eé]tica/i],
  ["siem", /\bsiem\b/i],
  ["soar", /\bsoar\b/i],
  ["edr", /\bedr\b/i],
  ["ndr", /\bndr\b/i],
  ["xdr", /\bxdr\b/i],
  ["ips", /\bips\b/i],
  ["waf", /\bwaf\b/i],
  ["anti-ddos", /anti[- ]?ddos|ddos/i],
  ["nist", /\bnist\b/i],
  ["sans", /\bsans\b/i],
  ["iso-27001", /iso\/iec 27001|iso 27001|27001\/27035/i],
  ["ux", /\bux\b|ux\/ui|ui\/ux|designer ux/i],
  ["ui", /\bui\b|ux\/ui|ui\/ux|designer ui/i],
  ["product", /product owner|product manager|\bpo\b/i],
  ["agile", /scrum|agile/i]
];

export const stripHtml = (html: string): string => {
  if (!html) return "";
  const $ = cheerio.load(html);

  $("p, div, li, br, h1, h2, h3, h4, h5, h6").each(function () {
    $(this).append(" ");
  });

  return $.text()
    .replace(/\.{2,}/g, ".")
    .replace(/\s+\./g, ".")
    .replace(/\.\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const detectSeniority = (text: string): Seniority => {
  if (/est[aá]gio|\bintern(ship)?\b|trainee/i.test(text)) return "intern";
  if (/j[uú]nior|\bjr\b|junior/i.test(text)) return "junior";
  if (/pleno|\bpl\b|\bmid\b/i.test(text)) return "mid";
  if (/s[eê]nior|\bsr\b|senior|especialista|staff|lead|principal/i.test(text)) return "senior";
  return "unknown";
};

export const detectWorkMode = (text: string): WorkMode => {
  if (/hybrid|h[ií]brid/i.test(text)) return "hybrid";
  if (/remote|remoto/i.test(text)) return "remote";
  if (/on-site|onsite|presencial/i.test(text)) return "onsite";
  return "unknown";
};

export const extractStack = (parts: Array<string | null | undefined>): string[] => {
  const text = parts.filter(Boolean).join(" ");
  const stack = new Set<string>();

  for (const [label, pattern] of STACK_PATTERNS) {
    if (pattern.test(text)) {
      stack.add(label);
    }
  }

  return [...stack].sort();
};

export const parseDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const formatLocation = (...parts: Array<string | null | undefined>): string | undefined => {
  const location = parts.map((part) => part?.trim()).filter(Boolean).join(", ");
  return location || undefined;
};
