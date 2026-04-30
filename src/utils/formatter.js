import translate from 'translate-google-api';

// lista de palavras-chave para identificar stacks tecnológicas na descrição
const TECH_KEYWORDS = [
  'React', 'Node', 'Python', 'Java', 'JavaScript', 'TypeScript', 
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
    // se der erro de limite (429), não avisa no console toda hora para não poluir
    if (!error?.message?.includes('429')) {
        console.error("⚠️ [translator] erro ao traduzir:", error.message);
    }
    return text; // retorna o texto original (inglês) como fallback
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

  const seniorityText = detectSeniority(job);
  const seniorityLine = seniorityText ? ` | 🎓 *${seniorityText.toUpperCase()}*` : '';

  // montagem final da string da mensagem
  let message = `
${sourceEmoji} *VAGA DETECTADA* ${langFlag}

🚀 *${job.title.toUpperCase()}*
🏢 *${job.company}*
━━━━━━━━━━━━━━━━━━━━━

${workModeEmoji} *modelo:* ${workModeText}${locationSuffix}${seniorityLine}${stackLine}

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










