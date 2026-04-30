import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';
import { translateText, detectAndTranslate, extractRequirements, extractStacks, cleanLocation, detectSeniority } from '../utils/formatter.js';

// função para ligar o bot do discord
export async function connectDiscord() {
    // configura as permissões (intents) do bot
    const client = new Client({ 
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
    });

    // avisa quando o bot estiver pronto
    client.once('ready', () => {
        console.log(`✅ [discord] bot online como: ${client.user.tag}`);
    });

    // tenta fazer o login usando o token do .env
    if (process.env.DISCORD_TOKEN) {
        await client.login(process.env.DISCORD_TOKEN);
    } else {
        console.log("⚠️ [discord] aviso: discord_token não encontrado no .env");
    }

    return client;
}

// função que constrói e envia o embed (aquela mensagem bonita) para o discord
export async function sendJobDiscord(client, job, channelId) {
    try {
        // busca o canal pelo id
        const channel = await client.channels.fetch(channelId);
        if (!channel) throw new Error("canal não encontrado");

        // prepara os dados: detecta idioma, traduz o resumo e os requisitos
        const rawSummary = job.description ? (job.description.substring(0, 300).trim() + '...') : '';
        const { translated: translatedSummary, detectedLang } = rawSummary
            ? await detectAndTranslate(rawSummary)
            : { translated: 'confira os detalhes no link.', detectedLang: 'pt' };
        
        const rawRequirements = extractRequirements(job.description);
        const translatedRequirements = rawRequirements ? await translateText(rawRequirements) : null;
        
        // mapa de label de origem por idioma detectado
        const ORIGIN_LABELS = {
            'en': '🇺🇸 vaga internacional (eua/uk)',
            'es': '🇪🇸 vaga internacional (esp/latam)',
            'fr': '🇫🇷 vaga internacional (frança)',
            'de': '🇩🇪 vaga internacional (alemanha)',
            'zh': '🇨🇳 vaga internacional (china)',
            'ja': '🇯🇵 vaga internacional (japão)',
            'ko': '🇰🇷 vaga internacional (coreia)',
        };
        const originLabel = ORIGIN_LABELS[detectedLang] || (detectedLang !== 'pt' ? '🌐 vaga internacional' : null);
        
        const stacks = extractStacks(job.description, job.stack || []);

        // emojis e labels para o modelo de trabalho
        const workModeEmoji = job.workMode === 'remote' ? '🌍' : (job.workMode === 'hybrid' ? '🏠' : '🏢');
        const workModeLabels = { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' };
        const workModeText = workModeLabels[job.workMode] || 'não informado';
        const cleanedLocation = cleanLocation(job.location);
        const locationSuffix = (job.workMode !== 'remote' && cleanedLocation) ? ` (${cleanedLocation})` : '';

        // paleta de cores premium (roxo)
        const palette = ['#7924ec', '#d580f8', '#080628', '#b130ff', '#5a0cb1'];
        
        // define a cor e o texto do embed baseado na senioridade da vaga
        const seniorityText = detectSeniority(job);
        const seniority = seniorityText.toLowerCase();
        let color = palette[Math.floor(Math.random() * palette.length)]; // cor aleatória da paleta como fallback
        
        if (seniority.includes('senior') || seniority.includes('sênior')) {
            color = '#7924ec'; // roxo vibrante para sênior
        } else if (seniority.includes('mid') || seniority.includes('pleno')) {
            color = '#d580f8'; // roxo claro para pleno
        } else if (seniority.includes('junior') || seniority.includes('júnior') || seniority.includes('estágio')) {
            color = '#b130ff'; // roxo intermediário para júnior
        } else if (seniority.includes('não informado')) {
            // se for desconhecido, pega uma cor aleatória da paleta para variar
            color = palette[Math.floor(Math.random() * palette.length)];
        }


        // constrói o objeto da mensagem (embed)
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🚀 ${job.title}`)
            .setAuthor({ name: job.company })
            .setDescription(`**resumo:**\n${translatedSummary}`)
            .addFields(
                { name: '🏢 empresa', value: job.company, inline: true },
                { name: '💻 modelo de trabalho', value: `${workModeEmoji} ${workModeText}${locationSuffix}`, inline: true },
                { name: '🎓 nível', value: seniorityText.toUpperCase(), inline: true },
            );

        // adiciona as tecnologias se encontradas
        if (stacks.length > 0) {
            embed.addFields({ name: '🛠️ stack / tecnologias', value: stacks.map(s => `\`${s}\``).join(', ') });
        }

        // adiciona o label de origem se a vaga for internacional
        if (originLabel) {
            embed.addFields({ name: '🌐 origem', value: originLabel });
        }

        // adiciona requisitos principais
        if (translatedRequirements) {
            embed.addFields({ name: '📋 requisitos principais', value: translatedRequirements });

        }

        embed.setFooter({ text: `fonte: ${job.source.toUpperCase()} | 🤖 vagas-bot` })
            .setTimestamp();

        // cria o botão de inscrição
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('candidatar-se na vaga')
                    .setURL(job.url)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🔗'),
            );

        // envia tudo para o canal
        await channel.send({ embeds: [embed], components: [row] });
        console.log(`✅ [discord] vaga enviada: ${job.title}`);
        return true;
    } catch (error) {
        console.error("❌ [discord] erro ao enviar mensagem:", error.message);
        return false;
    }
}





