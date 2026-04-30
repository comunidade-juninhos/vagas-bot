const STACK_LABELS = [
  ['react', 'React', /\breact\b/i],
  ['node', 'Node.js', /\bnode(?:\.js)?\b/i],
  ['python', 'Python', /\bpython\b/i],
  ['java', 'Java', /\bjava\b|spring boot|\bspring\b/i],
  ['javascript', 'JavaScript', /\bjavascript\b|\bjs\b/i],
  ['typescript', 'TypeScript', /\btypescript\b|\bts\b/i],
  ['aws', 'AWS', /\baws\b/i],
  ['azure', 'Azure', /\bazure\b/i],
  ['gcp', 'GCP', /\bgcp\b|google cloud/i],
  ['cloud', 'Cloud', /\bcloud\b|aws|azure|gcp/i],
  ['docker', 'Docker', /\bdocker\b/i],
  ['kubernetes', 'Kubernetes', /\bkubernetes\b|\bk8s\b/i],
  ['sql', 'SQL', /\bsql\b|postgres|mysql|oracle/i],
  ['api', 'APIs', /\bapis?\b|desenvolvimento de apis?/i],
  ['git', 'Git', /\bgit\b/i],
  ['asyncio', 'Asyncio', /\basyncio\b|ass[ií]ncrono|concorrente/i],
  ['testing', 'Testing', /\btesting\b|testes?|orientado a testes/i],
  ['web-scraping', 'Web Scraping', /web scraping|scraping/i],
  ['nosql', 'NoSQL', /\bnosql\b|mongodb/i],
  ['php', 'PHP', /\bphp\b|laravel/i],
  ['ruby', 'Ruby', /\bruby\b|rails/i],
  ['go', 'Go', /\bgolang\b|\bgo\b/i],
  ['flutter', 'Flutter', /\bflutter\b/i],
  ['angular', 'Angular', /\bangular\b/i],
  ['vue', 'Vue', /\bvue\b/i],
  ['csharp', 'C#', /\bc#\b/i],
  ['dotnet', '.NET', /\.net|dotnet/i],
  ['kotlin', 'Kotlin', /\bkotlin\b/i],
  ['swift', 'Swift', /\bswift\b/i],
  ['fullstack', 'Fullstack', /full[- ]?stack|fullstack/i],
  ['frontend', 'Frontend', /front[- ]?end|frontend/i],
  ['backend', 'Backend', /back[- ]?end|backend/i],
  ['data', 'Dados', /\bdados\b|\bdata\b|analytics|data science|engenharia de dados/i],
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

const LANGUAGE_HINTS = [
  ['pt', /\b(você|voce|gradua[cç][aã]o|ci[eê]ncia|seguran[cç]a|informa[cç][aã]o|experi[eê]ncia|conhecimento|requisitos e qualifica[cç][oõ]es|trabalho|remoto|h[ií]brido|benef[ií]cios|ingl[eê]s t[eé]cnico)\b/i],
  ['en', /\b(the|and|with|remote|requirements|experience|skills|team|software)\b/i],
  ['es', /\b(desarrollador|desarrolladora|equipo|conocimientos|experiencia comprobada|trabajo remoto|remoto desde|ser[aá]s|usuarios|aplicaciones)\b/i],
  ['fr', /\b(le|la|les|avec|exigences|expérience|équipe|logiciel)\b/i],
  ['de', /\b(und|mit|anforderungen|erfahrung|team|software)\b/i],
  ['it', /\b(il|la|con|requisiti|esperienza|squadra|software)\b/i],
];

function detectLanguage(text) {
  if (!text) return 'pt';

  for (const [lang, pattern] of LANGUAGE_HINTS) {
    if (pattern.test(text)) return lang;
  }

  return 'pt';
}

export function cleanText(value) {
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

export function summarizeText(value, maxLength = 320) {
  const text = cleanText(value);
  if (!text || text.length <= maxLength) return text;

  const slice = text.slice(0, maxLength + 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (sentenceEnd >= 80) return slice.slice(0, sentenceEnd + 1).trim();

  const wordEnd = slice.lastIndexOf(' ');
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxLength).trim()}...`;
}

// função que varre o texto e extrai as tecnologias encontradas
export function extractStacks(description, existingStacks = []) {
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
export async function detectAndTranslate(text) {
  if (!text) return { translated: '', detectedLang: 'pt' };
  return { translated: text, detectedLang: detectLanguage(text) };
}

// mantida para compatibilidade com outros módulos que a usam
export async function translateText(text) {
  const { translated } = await detectAndTranslate(text);
  return translated;
}

// tenta extrair os requisitos (bullet points) de dentro da descrição da vaga
export function extractRequirements(description) {
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
export function cleanLocation(location) {
  if (!location) return '';
  let cleaned = cleanText(location).replace(/\{.*?\}/g, '').trim();
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  return cleaned;
}

// mapa de bandeiras e contexto de origem por idioma
const LANG_INFO = {
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
function getLangInfo(lang) {
  return LANG_INFO[lang?.toLowerCase()] || { flag: '🌐', label: '🌐 vaga internacional' };
}

// tenta deduzir a senioridade se ela vier vazia ou desconhecida
export function detectSeniority(job) {
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

// função principal que monta a mensagem bonita para o whatsapp/discord
export async function formatJobMessage(job) {
  const stacks = extractStacks(job.description, job.stack || []);
  
  // emojis e textos para o modelo de trabalho
  const workModeEmoji = job.workMode === 'remote' ? '🌍' : (job.workMode === 'hybrid' ? '🏠' : '🏢');
  const workModeLabels = { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' };
  const workModeText = workModeLabels[job.workMode] || 'não informado';
  
  const cleanedLocation = cleanLocation(job.location);
  const locationSuffix = (job.workMode !== 'remote' && cleanedLocation) ? ` (${cleanedLocation})` : '';

  const sourceEmoji = job.source === 'gupy' ? '💚' : '💙';

  // detecta o idioma e traduz o resumo
  const rawSummary = job.description ? summarizeText(job.description, 260) : '';
  const { translated: translatedSummary, detectedLang } = rawSummary
    ? await detectAndTranslate(rawSummary)
    : { translated: 'confira os detalhes no link.', detectedLang: 'pt' };

  // usa o idioma detectado para mostrar a origem da vaga
  const langInfo = getLangInfo(detectedLang);

  // traduz os requisitos (se existirem)
  const rawRequirements = extractRequirements(job.description);
  const translatedRequirements = rawRequirements ? await translateText(rawRequirements) : null;

  // linha de tecnologias formatada
  const stackLine = stacks.length > 0 
    ? `\n🛠️ *techs:* ${stacks.map(s => `_${s}_`).join(', ')}` 
    : `\n🔍 *requisitos:* ver detalhes no link`;

  const seniorityText = detectSeniority(job);
  const seniorityLine = seniorityText ? ` | 🎓 *${seniorityText.toUpperCase()}*` : '';

  // label de origem para vagas internacionais (ex: 🇺🇸 vaga internacional (eua/uk))
  const originLine = langInfo.label ? `\n🌐 *${langInfo.label}*` : '';

  // montagem final da string da mensagem
  let message = `
${sourceEmoji} *VAGA DETECTADA* ${langInfo.flag}

🚀 *${job.title.toUpperCase()}*
🏢 *${job.company}*
━━━━━━━━━━━━━━━━━━━━━

${workModeEmoji} *modelo:* ${workModeText}${locationSuffix}${seniorityLine}${stackLine}${originLine}

📝 *resumo:*
${translatedSummary}
`;



  if (translatedRequirements) {
    message += `\n📋 *principais requisitos:*
${translatedRequirements}\n`;
  }

  message += `
🔗 *link para inscrição:*
${job.url}

━━━━━━━━━━━━━━━━━━━━━
_🤖 vagas-bot via ${job.source.toUpperCase()}_
`;

  return message.trim();
}


