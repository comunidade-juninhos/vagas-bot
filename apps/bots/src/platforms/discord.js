import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import 'dotenv/config';
import {
    cleanLocation,
    detectSeniority,
    extractRequirements,
    extractStacks,
    summarizeText
} from '../utils/formatter.js';

// função para ligar o bot do discord
export async function connectDiscord() {
    if (!process.env.DISCORD_TOKEN) {
        console.log("⚠️ [discord] DISCORD_TOKEN não configurado. Discord desativado.");
        return null;
    }

    // configura as permissões (intents) do bot
    const client = new Client({ 
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
    });

    // avisa quando o bot estiver pronto
    client.once('ready', () => {
        console.log(`✅ [discord] bot online como: ${client.user.tag}`);
    });

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}

const SENIORITY_LABELS = {
    intern: 'Estágio',
    junior: 'Júnior',
    mid: 'Pleno',
    senior: 'Sênior',
    unknown: 'Nível não informado',
};

const WORK_MODE_LABELS = {
    remote: 'Remoto',
    hybrid: 'Híbrido',
    onsite: 'Presencial',
    unknown: 'Modelo não informado',
};

const SOURCE_COLORS = {
    meupadrinho: '#D97706',
    gupy: '#20A464',
    remotar: '#2563EB',
    linkedin: '#0A66C2',
    indeed: '#2557A7',
};

function buildMetaLine(job, seniorityText) {
    const parts = [];
    const workMode = WORK_MODE_LABELS[job.workMode] || WORK_MODE_LABELS.unknown;
    const location = cleanLocation(job.location);

    parts.push(workMode);
    if (location && job.workMode !== 'remote') parts.push(location);
    if (seniorityText && seniorityText !== 'Não Informado') parts.push(seniorityText);

    return parts.join(' • ');
}

export async function buildDiscordJobPayload(job) {
    const summary = summarizeText(job.description || 'Confira os detalhes no link da vaga.', 360);
    const stacks = extractStacks(job.description, job.stack || []).slice(0, 16);
    const requirements = extractRequirements(job.description);
    const seniorityText = SENIORITY_LABELS[job.seniority] || detectSeniority(job);
    const metaLine = buildMetaLine(job, seniorityText);
    const color = SOURCE_COLORS[job.source] || '#111827';

    const descriptionParts = [
        `**${job.company || 'Empresa não informada'}**`,
        metaLine,
        '',
        summary,
    ].filter(Boolean);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(job.title)
        .setURL(job.url)
        .setDescription(descriptionParts.join('\n'))
        .setFooter({ text: String(job.source || 'fonte').toUpperCase() })
        .setTimestamp();

    if (stacks.length > 0) {
        embed.addFields({ name: 'Stack', value: stacks.join(' • ') });
    }

    if (requirements) {
        embed.addFields({ name: 'Requisitos', value: requirements });
    }

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Ver vaga')
                .setURL(job.url)
                .setStyle(ButtonStyle.Link),
        );

    return { embeds: [embed], components: [row] };
}

// função que constrói e envia o embed (aquela mensagem bonita) para o discord
export async function sendJobDiscord(client, job, channelId) {
    try {
        // busca o canal pelo id
        const channel = await client.channels.fetch(channelId);
        if (!channel) throw new Error("canal não encontrado");

        // envia tudo para o canal
        await channel.send(await buildDiscordJobPayload(job));
        console.log(`✅ [discord] vaga enviada: ${job.title}`);
        return true;
    } catch (error) {
        console.error("❌ [discord] erro ao enviar mensagem:", error.message);
        return false;
    }
}
