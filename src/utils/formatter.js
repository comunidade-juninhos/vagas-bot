import translate from 'translate-google-api';

const TECH_KEYWORDS = [
  'React', 'Node', 'Python', 'Java', 'Javascript', 'Typescript', 'TypeScript', 'JavaScript', 
  'AWS', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'PHP', 'Ruby', 'Go', 'Flutter', 'Angular', 
  'Vue', 'C#', '.NET', 'Kotlin', 'Swift', 'Azure', 'GCP', 'Spring', 'Hibernate', 'Laravel'
];

export function extractStacks(description, existingStacks = []) {
  if (!description) return existingStacks;
  const found = TECH_KEYWORDS.filter(tech => 
    new RegExp(`\\b${tech}\\b`, 'i').test(description)
  );
  return [...new Set([...existingStacks, ...found])];
}

export async function translateText(text) {
  if (!text) return '';
  try {
    const result = await translate(text, {
      tld: "com",
      to: "pt",
    });
    return result[0];
  } catch (error) {
    console.error("⚠️ [TRANSLATOR] Failed to translate:", error.message);
    return text;
  }
}

/**
 * Tenta extrair pontos-chave (bullet points) da descrição
 */
export function extractRequirements(description) {
  if (!description) return null;
  const markers = ['requisitos', 'requirements', 'qualificações', 'qualifications', 'o que buscamos', 'what we look for', 'conhecimentos'];
  const lowerDesc = description.toLowerCase();
  
  for (const marker of markers) {
    const index = lowerDesc.indexOf(marker);
    if (index !== -1) {
      const block = description.substring(index, index + 600);
      // Tenta quebrar por linhas e pegar o que parece ser uma lista
      const lines = block.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5 && (l.startsWith('-') || l.startsWith('*') || l.startsWith('•') || /^[0-9]\./.test(l)));
      
      if (lines.length > 0) {
        return lines.slice(0, 4).join('\n');
      }
      // Fallback: pega um pedaço menor e mais limpo
      return description.substring(index + marker.length + 1, index + marker.length + 200).trim() + '...';
    }
  }
  return null;
}

export function cleanLocation(location) {
  if (!location) return '';
  let cleaned = location.replace(/\{.*?\}/g, '').trim();
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  return cleaned;
}

export async function formatJobMessage(job) {
  const stacks = extractStacks(job.description, job.stack || []);
  
  // Formatação do Modelo de Trabalho e Limpeza de Localização
  const workModeEmoji = job.workMode === 'remote' ? '🌍' : (job.workMode === 'hybrid' ? '🏠' : '🏢');
  const workModeLabels = { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' };
  const workModeText = workModeLabels[job.workMode] || 'Não informado';
  
  const cleanedLocation = cleanLocation(job.location);
  // Só mostra localização se NÃO for remoto
  const locationSuffix = (job.workMode !== 'remote' && cleanedLocation) ? ` (${cleanedLocation})` : '';


  
  const sourceEmoji = job.source === 'gupy' ? '💚' : '💙';

  // Translation
  const rawSummary = job.description ? (job.description.substring(0, 250).trim() + '...') : '';
  const translatedSummary = rawSummary ? await translateText(rawSummary) : 'Confira os detalhes no link.';
  
  const rawRequirements = extractRequirements(job.description);
  const translatedRequirements = rawRequirements ? await translateText(rawRequirements) : null;

  const stackLine = stacks.length > 0 
    ? `\n🛠️ *Techs:* ${stacks.map(s => `_${s}_`).join(', ')}` 
    : `\n🔍 *Requisitos:* Ver detalhes no link`;

  const seniorityLine = job.seniority ? ` | 🎓 *${job.seniority.toUpperCase()}*` : '';

  let message = `
${sourceEmoji} *VAGA DETECTADA*

🚀 *${job.title.toUpperCase()}*
🏢 *${job.company}*
━━━━━━━━━━━━━━━━━━━━━

${workModeEmoji} *Modelo:* ${workModeText}${locationSuffix}${seniorityLine}${stackLine}

📝 *Resumo:*
${translatedSummary}
`;


  if (translatedRequirements) {
    message += `\n📋 *Principais Requisitos:*
${translatedRequirements}\n`;
  }

  message += `
🔗 *Link para inscrição:*
${job.url}

━━━━━━━━━━━━━━━━━━━━━
_🤖 Vagas-Bot via ${job.source.toUpperCase()}_
`;

  return message.trim();
}








