import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';
import { translateText, extractRequirements, extractStacks, cleanLocation } from '../utils/formatter.js';

export async function connectDiscord() {
    const client = new Client({ 
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
    });

    client.once('ready', () => {
        console.log(`✅ [DISCORD] Bot online as: ${client.user.tag}`);
    });

    if (process.env.DISCORD_TOKEN) {
        await client.login(process.env.DISCORD_TOKEN);
    } else {
        console.log("⚠️ [DISCORD] Warning: DISCORD_TOKEN not found in .env");
    }

    return client;
}

export async function sendJobDiscord(client, job, channelId) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) throw new Error("Channel not found");

        // Prepara dados traduzidos e extraídos
        const rawSummary = job.description ? (job.description.substring(0, 300).trim() + '...') : '';
        const translatedSummary = rawSummary ? await translateText(rawSummary) : 'Confira os detalhes no link.';
        
        const rawRequirements = extractRequirements(job.description);
        const translatedRequirements = rawRequirements ? await translateText(rawRequirements) : null;
        
        const stacks = extractStacks(job.description, job.stack || []);

        const workModeEmoji = job.workMode === 'remote' ? '🌍' : (job.workMode === 'hybrid' ? '🏠' : '🏢');
        const workModeLabels = { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' };
        const workModeText = workModeLabels[job.workMode] || 'Não informado';
        const cleanedLocation = cleanLocation(job.location);
        const locationSuffix = (job.workMode !== 'remote' && cleanedLocation) ? ` (${cleanedLocation})` : '';


        const seniority = (job.seniority || 'unknown').toLowerCase();
        let color = '#0099ff'; 
        if (seniority.includes('senior')) color = '#ffcc00'; 
        else if (seniority.includes('mid') || seniority.includes('pleno')) color = '#95a5a6'; 
        else if (seniority.includes('junior')) color = '#e67e22'; 

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🚀 ${job.title}`)
            .setAuthor({ name: job.company })
            .setDescription(`**Resumo:**\n${translatedSummary}`)
            .addFields(
                { name: '🏢 Empresa', value: job.company, inline: true },
                { name: '💻 Modelo de Trabalho', value: `${workModeEmoji} ${workModeText}${locationSuffix}`, inline: true },
                { name: '🎓 Nível', value: (job.seniority || 'N/A').toUpperCase(), inline: true },
            );


        if (stacks.length > 0) {
            embed.addFields({ name: '🛠️ Stack / Tecnologias', value: stacks.map(s => `\`${s}\``).join(', ') });
        }

        if (translatedRequirements) {
            embed.addFields({ name: '📋 Requisitos Principais', value: translatedRequirements });
        }

        embed.setFooter({ text: `Fonte: ${job.source.toUpperCase()} | 🤖 Vagas-Bot` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Candidatar-se na Vaga')
                    .setURL(job.url)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🔗'),
            );

        await channel.send({ embeds: [embed], components: [row] });
        console.log(`✅ [DISCORD] Job sent: ${job.title}`);

    } catch (error) {
        console.error("❌ [DISCORD] Error sending message:", error.message);
    }
}




