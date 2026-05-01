import { buildNotificationJob } from "../../../../packages/core/notification.js";
import type { JobDTO, JobLanguage } from "../../../../packages/core/types.js";

const STACK_LABELS: Array<[string, string, RegExp]> = [
  ['react', 'React', /\breact\b/i],
  ['angular', 'Angular', /\bangular\b/i],
  ['vue', 'Vue', /\bvue\.?js?\b|\bvuejs\b/i],
  ['nextjs', 'Next.js', /\bnext\.?js\b/i],
  ['node', 'Node.js', /\bnode(?:\.js)?\b/i],
  ['python', 'Python', /\bpython\b/i],
  ['java', 'Java', /\bjava\b|spring boot|\bspring\b/i],
  ['javascript', 'JavaScript', /\bjavascript\b|\bjs\b/i],
  ['typescript', 'TypeScript', /\btypescript\b|\bts\b/i],
  ['kotlin', 'Kotlin', /\bkotlin\b/i],
  ['swift', 'Swift', /\bswift\b/i],
  ['flutter', 'Flutter', /\bflutter\b|\bdart\b/i],
  ['csharp', 'C#', /\bc#\b/i],
  ['dotnet', '.NET', /\.net|dotnet/i],
  ['php', 'PHP', /\bphp\b|laravel/i],
  ['ruby', 'Ruby', /\bruby\b|rails/i],
  ['go', 'Go', /\bgolang\b|\bgo\b/i],
  ['rust', 'Rust', /\brust\b/i],
  ['aws', 'AWS', /\baws\b/i],
  ['azure', 'Azure', /\bazure\b/i],
  ['gcp', 'GCP', /\bgcp\b|google cloud/i],
  ['cloud', 'Cloud', /\bcloud\b|aws|azure|gcp/i],
  ['docker', 'Docker', /\bdocker\b/i],
  ['kubernetes', 'Kubernetes', /\bkubernetes\b|\bk8s\b/i],
  ['terraform', 'Terraform', /\bterraform\b|\biac\b/i],
  ['sql', 'SQL', /\bsql\b|postgres|mysql|oracle/i],
  ['nosql', 'NoSQL', /\bnosql\b|mongodb|\bmongo\b|dynamodb|cassandra/i],
  ['redis', 'Redis', /\bredis\b/i],
  ['kafka', 'Kafka', /\bkafka\b|rabbitmq/i],
  ['graphql', 'GraphQL', /\bgraphql\b/i],
  ['api', 'APIs', /\bapis?\b|desenvolvimento de apis?|\brest\b/i],
  ['git', 'Git', /\bgit\b/i],
  ['cypress', 'Cypress', /\bcypress\b/i],
  ['selenium', 'Selenium', /\bselenium\b/i],
  ['testing', 'Testing', /\btesting\b|testes?|orientado a testes/i],
  ['web-scraping', 'Web Scraping', /web scraping|scraping/i],
  ['fullstack', 'Fullstack', /full[- ]?stack|fullstack/i],
  ['frontend', 'Frontend', /front[- ]?end|frontend/i],
  ['backend', 'Backend', /back[- ]?end|backend/i],
  ['data', 'Dados', /\bdados\b|\bdata\b|analytics|data science|engenharia de dados/i],
  ['bi', 'BI', /\bbi\b|business intelligence|power ?bi/i],
  ['ai', 'AI/ML', /\bia\b|\bai\b|intelig[eê]ncia artificial|machine learning|\bml\b|\bllm\b|\bgpt\b/i],
  ['elasticsearch', 'Elasticsearch', /elasticsearch|\belastic\b|\belk\b/i],
  ['figma', 'Figma', /\bfigma\b/i],
  ['ux', 'UX', /\bux\b|ux\/ui|ui\/ux|designer ux/i],
  ['ui', 'UI', /\bui\b|ux\/ui|ui\/ux|designer ui/i],
  ['devops', 'DevOps', /\bdevops\b/i],
  ['sre', 'SRE', /\bsre\b/i],
  ['cybersecurity', 'Cybersecurity', /cyber ?security|ciberseguran[cç]a|seguran[cç]a da informa[cç][aã]o|csirt|soc|blue team/i],
  ['siem', 'SIEM', /\bsiem\b/i],
  ['soar', 'SOAR', /\bsoar\b/i],
  ['edr', 'EDR', /\bedr\b/i],
  ['ndr', 'NDR', /\bndr\b/i],
  ['xdr', 'XDR', /\bxdr\b/i],
  ['ips', 'IPS', /\bips\b/i],
  ['waf', 'WAF', /\bwaf\b/i],
  ['anti-ddos', 'Anti-DDoS', /anti[- ]?ddos|ddos/i],
  ['nist', 'NIST', /\bnist\b/i],
  ['sans', 'SANS', /\bsans\b/i],
  ['iso-27001', 'ISO 27001', /iso\/iec 27001|iso 27001|27001\/27035/i],
];

const STACK_ALIASES = new Map(
  STACK_LABELS.flatMap(([key, label]) => [
    [key, label],
    [label.toLowerCase(), label],
    [label.toLowerCase().replace(/[.#]/g, ''), label],
  ])
);

const LANGUAGE_HINTS: Array<[JobLanguage, RegExp]> = [
  ['pt', /\b(você|voce|gradua[cç][aã]o|ci[eê]ncia|seguran[cç]a|informa[cç][aã]o|experi[eê]ncia|conhecimento|requisitos e qualifica[cç][oõ]es|trabalho|remoto|h[ií]brido|benef[ií]cios|ingl[eê]s t[eé]cnico)\b/i],
  ['en', /\b(the|and|with|remote|requirements|experience|skills|team|software)\b/i],
  ['es', /\b(desarrollador|desarrolladora|equipo|conocimientos|experiencia comprobada|trabajo remoto|remoto desde|ser[aá]s|usuarios|aplicaciones)\b/i],
  ['fr', /\b(le|la|les|avec|exigences|expérience|équipe|logiciel)\b/i],
  ['de', /\b(und|mit|anforderungen|erfahrung|team|software)\b/i],
  ['it', /\b(il|la|con|requisiti|esperienza|squadra|software)\b/i],
];

function detectLanguage(text: string): JobLanguage {
  if (!text) return 'pt';

  for (const [lang, pattern] of LANGUAGE_HINTS) {
    if (pattern.test(text)) return lang;
  }

  return 'pt';
}

export function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\\n/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/(SQL)(APIs?)/gi, '$1 $2')
    .replace(/([a-zá-ú0-9])([A-ZÁ-Ú])/g, '$1 $2')
    .replace(/([.!?])(?=\S)/g, '$1 ')
    .replace(/\be\s*\.\s*NET\b/gi, 'e .NET')
    .replace(/\bDDo\s+S\b/g, 'DDoS')
    .replace(/\s+/g, ' ')
    .trim();
}

export function summarizeText(value: unknown, maxLength = 320): string {
  const text = cleanText(value);
  if (!text || text.length <= maxLength) return text;

  const slice = text.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (sentenceEnd >= 80) return slice.slice(0, sentenceEnd + 1).trim();

  const wordEnd = slice.lastIndexOf(' ');
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxLength).trim()}...`;
}

// função que varre o texto e extrai as tecnologias encontradas
export function extractStacks(description: unknown, existingStacks: string[] = []): string[] {
  const text = cleanText(description);
  const found = new Map();

  for (const stack of existingStacks ?? []) {
    const normalized = String(stack).trim().toLowerCase();
    const label = STACK_ALIASES.get(normalized) ?? STACK_ALIASES.get(normalized.replace(/[.#]/g, '')) ?? String(stack).trim();
    if (label) found.set(label.toLowerCase(), label);
  }

  for (const [key, label, pattern] of STACK_LABELS) {
    if (pattern.test(text) || found.has(key)) {
      found.set(label.toLowerCase(), label);
    }
  }

  return [...found.values()].sort((a, b) => {
    const aIndex = STACK_LABELS.findIndex(([, label]) => label === a);
    const bIndex = STACK_LABELS.findIndex(([, label]) => label === b);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

// detecta idioma com heurística leve e mantém o texto original sem chamada externa
export async function detectAndTranslate(text: string): Promise<{ translated: string; detectedLang: JobLanguage }> {
  if (!text) return { translated: '', detectedLang: 'pt' };
  return { translated: text, detectedLang: detectLanguage(text) };
}

// mantida para compatibilidade com outros módulos que a usam
export async function translateText(text: string): Promise<string> {
  const { translated } = await detectAndTranslate(text);
  return translated;
}

// tenta extrair os requisitos (bullet points) de dentro da descrição da vaga
export function extractRequirements(description: unknown): string | null {
  if (!description) return null;
  const normalized = String(description)
    .replace(/\\n/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/\bDDo\s+S\b/g, 'DDoS');

  const sectionMarker = /(requisitos(?:\s+e\s+qualifica[cç][oõ]es)?|qualifica[cç][oõ]es|requirements|qualifications|o que buscamos|what we look for|conhecimentos)\s*:?\s*/i;
  const sectionMatch = normalized.match(sectionMarker);

  if (sectionMatch?.index !== undefined) {
    const start = sectionMatch.index + sectionMatch[0].length;
    const stopMarker = /\n\s*(ser[aá]\s+um\s+diferencial|diferenciais|desej[aá]veis|benef[ií]cios|benefits|responsabilidades|sobre a empresa|remunera[cç][aã]o|sal[aá]rio|o que n[oó]s oferecemos|tipo de contrato|n[ií]vel|faixa salarial)\b/i;
    const tail = normalized.slice(start);
    const stop = tail.search(stopMarker);
    const block = (stop >= 0 ? tail.slice(0, stop) : tail).trim();
    const lines = block
      .split(/\n+|[•]/)
      .map((line) => cleanText(line).replace(/^[-*:]\s*/, '').replace(/^[;,.]\s*/, ''))
      .filter((line) => line.length > 12)
      .filter((line) => !/^o que (voc[eê]|voce) precisa ter ou saber\??$/i.test(line));

    if (lines.length > 1) {
      return lines
        .slice(0, 7)
        .map((line) => line.replace(/[;.]$/, ''))
        .join('\n');
    }
  }

  const cleaned = cleanText(description);
  const markers = [
    /requisitos(?:\s+e\s+qualifica[cç][oõ]es)?/i,
    /qualifica[cç][oõ]es/i,
    /requirements/i,
    /qualifications/i,
    /o que buscamos/i,
    /what we look for/i,
    /conhecimentos/i,
  ];
  const stopMarkers = /\b(benef[ií]cios|benefits|diferenciais|desej[aá]veis|responsabilidades|sobre a empresa|remunera[cç][aã]o|sal[aá]rio)\b/i;
  
  for (const marker of markers) {
    const match = cleaned.match(marker);
    if (match?.index !== undefined) {
      const start = match.index + match[0].length;
      let block = cleaned.slice(start, start + 700).trim().replace(/^[:\-–]\s*/, '');
      const stop = block.search(stopMarkers);
      if (stop > 40) block = block.slice(0, stop).trim();
      const lines = block.split(/[•\n;]|(?:^|\s)-\s+/)
        .map((line) => cleanText(line).replace(/^[-*:]\s*/, ''))
        .filter((line) => line.length > 12);
      
      if (lines.length > 0) {
        return summarizeText(lines.slice(0, 3).join('. '), 320);
      }

      return summarizeText(block, 320);
    }
  }
  return null;
}

// limpa caracteres estranhos da localização (comum em alguns scrapers)
export function cleanLocation(location: unknown): string {
  if (!location) return '';
  let cleaned = cleanText(location).replace(/\{.*?\}/g, '').trim();
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  return cleaned;
}

// mapa de bandeiras e contexto de origem por idioma
const LANG_INFO: Partial<Record<JobLanguage | string, { flag: string; label: string | null }>> = {
  'pt': { flag: '🇧🇷', label: null },                      // português: sem label (vaga local)
  'en': { flag: '🇺🇸', label: '🇺🇸 vaga internacional (eua/uk)' },
  'es': { flag: '🇪🇸', label: '🇪🇸 vaga internacional (esp/latam)' },
  'fr': { flag: '🇫🇷', label: '🇫🇷 vaga internacional (frança)' },
  'de': { flag: '🇩🇪', label: '🇩🇪 vaga internacional (alemanha)' },
  'it': { flag: '🇮🇹', label: '🇮🇹 vaga internacional (itália)' },
  'zh': { flag: '🇨🇳', label: '🇨🇳 vaga internacional (china)' },
  'ja': { flag: '🇯🇵', label: '🇯🇵 vaga internacional (japão)' },
  'ko': { flag: '🇰🇷', label: '🇰🇷 vaga internacional (coreia)' },
  'th': { flag: '🇹🇭', label: '🇹🇭 vaga internacional (tailândia)' },
};

// retorna a bandeira e o label de origem baseado no idioma detectado
function getLangInfo(lang: string) {
  return LANG_INFO[lang?.toLowerCase()] || { flag: '🌐', label: '🌐 vaga internacional' };
}

// tenta deduzir a senioridade se ela vier vazia ou desconhecida
export function detectSeniority(job: Pick<JobDTO, "title" | "description" | "seniority">): string {
  const text = (job.title + ' ' + (job.description || '')).toLowerCase();
  
  // se já tiver uma senioridade válida, usa ela
  if (job.seniority && !['unknown', 'desconhecido', 'n/a', 'não informado'].includes(job.seniority.toLowerCase())) {
    return job.seniority;
  }
  
  // busca por palavras-chave no título e descrição
  if (text.includes('senior') || text.includes('sênior') || /\bsr\b/i.test(text)) return 'Sênior';
  if (text.includes('pleno') || /\bpl\b/i.test(text) || text.includes('mid-level')) return 'Pleno';
  if (text.includes('junior') || text.includes('júnior') || /\bjr\b/i.test(text)) return 'Júnior';
  if (text.includes('estagiário') || text.includes('estagio') || text.includes('intern') || text.includes('trainee')) return 'Estágio';
  if (text.includes('especialista') || text.includes('specialist') || text.includes('lead') || text.includes('staff')) return 'Especialista';
  
  return 'Não Informado'; 
}

// função principal que monta a mensagem bonita para o whatsapp
export async function formatJobMessage(job: JobDTO): Promise<string> {
  const notification = buildNotificationJob(job);
  const lines = [];

  if (notification.internationalLabel) {
    lines.push(`🌎 *VAGA INTERNACIONAL*`, '');
  }

  lines.push(`🚀 *${notification.title}*`, '');
  lines.push(`🏢 *Empresa:* ${notification.company}`);

  if (notification.locationLabel) {
    lines.push(`📍 *Local:* ${notification.locationLabel}`);
  }

  if (notification.workModeLabel) {
    lines.push(`${notification.workModeEmoji} *Modelo:* ${notification.workModeLabel}`);
  }

  if (notification.seniorityLabel) {
    lines.push(`${notification.seniorityEmoji} *Nível:* ${notification.seniorityLabel}`);
  }

  if (notification.salaryLabel) {
    lines.push(`💰 *Salário:* ${notification.salaryLabel}`);
  }

  if (notification.summary) {
    lines.push('', `📝 *Resumo:*`, notification.summary);
  }

  if (notification.stackLabels.length > 0) {
    lines.push('', `🛠️ *Tecnologias:*`, notification.stackLabels.join(', '));
  }

  if (notification.requirementBullets.length > 0) {
    const limitedBullets = notification.requirementBullets.slice(0, 4);
    lines.push('', `📋 *Requisitos:*`, ...limitedBullets.map((item) => `• ${summarizeText(item, 120)}`));
  }

  const cleanUrl = notification.url.replace(/[?&]jobBoardSource=[^&]+/i, '');
  lines.push('', `🔗 *Candidatar-se:*`, cleanUrl);

  const footerParts = [`Fonte: ${notification.sourceLabel}`];
  if (notification.publishedAtLabel) {
    footerParts.push(`Publicada em ${notification.publishedAtLabel}`);
  }
  lines.push('', `_${footerParts.join(' • ')}_`);

  return lines.join('\n').trim();
}
