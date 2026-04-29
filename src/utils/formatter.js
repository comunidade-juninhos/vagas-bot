import translate from 'translate-google-api';

// lista de palavras-chave para identificar stacks tecnológicas na descrição
const TECH_KEYWORDS = [
  'React', 'Node', 'Python', 'Java', 'Javascript', 'Typescript', 'TypeScript', 'JavaScript', 
  'AWS', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'PHP', 'Ruby', 'Go', 'Flutter', 'Angular', 
  'Vue', 'C#', '.NET', 'Kotlin', 'Swift', 'Azure', 'GCP', 'Spring', 'Hibernate', 'Laravel'
];

// função que varre o texto e extrai as tecnologias encontradas
export function extractStacks(description, existingStacks = []) {
  if (!description) return existingStacks;
  const found = TECH_KEYWORDS.filter(tech => 
    new RegExp(`\\b${tech}\\b`, 'i').test(description)
  );
  return [...new Set([...existingStacks, ...found])];
}

// função que traduz o texto para português usando a api do google
export async function translateText(text) {
  if (!text) return '';
  try {
    const result = await translate(text, {
      tld: "com",
      to: "pt",
    });
    return result[0];
  } catch (error) {
    console.error("⚠️ [translator] erro ao traduzir:", error.message);
    return text;
  }
}

// tenta extrair os requisitos (bullet points) de dentro da descrição da vaga
export function extractRequirements(description) {
  if (!description) return null;
  const markers = ['requisitos', 'requirements', 'qualificações', 'qualifications', 'o que buscamos', 'what we look for', 'conhecimentos'];
  const lowerDesc = description.toLowerCase();
  
  for (const marker of markers) {
    const index = lowerDesc.indexOf(marker);
    if (index !== -1) {
      const block = description.substring(index, index + 600);
      const lines = block.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5 && (l.startsWith('-') || l.startsWith('*') || l.startsWith('•') || /^[0-9]\./.test(l)));
      
      if (lines.length > 0) {
        return lines.slice(0, 4).join('\n');
      }
      return description.substring(index + marker.length + 1, index + marker.length + 200).trim() + '...';
    }
  }
  return null;
}

// limpa caracteres estranhos da localização (comum em alguns scrapers)
export function cleanLocation(location) {
  if (!location) return '';
  let cleaned = location.replace(/\{.*?\}/g, '').trim();
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  return cleaned;
}

// mapa de bandeiras por idioma
const LANG_FLAGS = {
  'pt': '🇧🇷',
  'en': '🇺🇸',
  'es': '🇪🇸',
  'fr': '🇫🇷',
  'de': '🇩🇪',
  'it': '🇮🇹',
  'zh': '🇨🇳',
  'ja': '🇯🇵',
  'th': '🇹🇭'
};

// retorna a bandeira correta baseada no idioma original
function getLanguageFlag(lang) {
  return LANG_FLAGS[lang?.toLowerCase()] || '🌐';
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
  const langFlag = getLanguageFlag(job.originalLanguage);

  // processo de tradução do resumo e dos requisitos
  const rawSummary = job.description ? (job.description.substring(0, 250).trim() + '...') : '';
  const translatedSummary = rawSummary ? await translateText(rawSummary) : 'confira os detalhes no link.';
  
  const rawRequirements = extractRequirements(job.description);
  const translatedRequirements = rawRequirements ? await translateText(rawRequirements) : null;

  // linha de tecnologias formatada
  const stackLine = stacks.length > 0 
    ? `\n🛠️ *techs:* ${stacks.map(s => `_${s}_`).join(', ')}` 
    : `\n🔍 *requisitos:* ver detalhes no link`;

  const seniorityLine = job.seniority ? ` | 🎓 *${job.seniority.toUpperCase()}*` : '';

  // montagem final da string da mensagem
  let message = `
${sourceEmoji} *VAGA DETECTADA* ${langFlag}

🚀 *${job.title.toUpperCase()}*
🏢 *${job.company}*
━━━━━━━━━━━━━━━━━━━━━

${workModeEmoji} *modelo:* ${workModeText}${locationSuffix}${seniorityLine}${stackLine}

📝 *resumo (traduzido):*
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










