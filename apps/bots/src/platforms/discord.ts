import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { ColorResolvable } from 'discord.js';
import 'dotenv/config';
import { buildNotificationJob } from '../../../../packages/core/notification.js';
import type { NotificationJob } from '../../../../packages/core/notification.js';
import type { JobDTO } from '../../../../packages/core/types.js';

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
        console.log(`✅ [discord] bot online como: ${client.user?.tag ?? "desconhecido"}`);
    });

    await client.login(process.env.DISCORD_TOKEN);

    return client;
}

export async function buildDiscordJobPayload(job: JobDTO) {
    const notification = buildNotificationJob(job);
    const infoParts = [];

    if (notification.workModeLabel) {
        infoParts.push(`${notification.workModeEmoji} ${notification.workModeLabel}`);
    }
    if (notification.locationLabel) {
        infoParts.push(`📍 ${notification.locationLabel}`);
    }
    if (notification.seniorityLabel) {
        infoParts.push(`${notification.seniorityEmoji} ${notification.seniorityLabel}`);
    }

    const descriptionParts = [];
    if (notification.internationalLabel) {
        descriptionParts.push(notification.internationalLabel, '');
    }
    descriptionParts.push(`🏢 ${notification.company}`);
    if (infoParts.length > 0) {
        descriptionParts.push(infoParts.join(' • '));
    }
    if (notification.salaryLabel) {
        descriptionParts.push(`💰 ${notification.salaryLabel}`);
    }
    if (notification.summary) {
        descriptionParts.push('', toBlockQuote(notification.summary));
    }

    const embed = new EmbedBuilder()
        .setColor(notification.sourceColor as ColorResolvable)
        .setTitle(`🚀 ${notification.title}`)
        .setURL(notification.url)
        .setDescription(descriptionParts.join('\n'))
        .setFooter({
            text: buildFooter(notification),
        })
        .setTimestamp();

    if (notification.stackLabels.length > 0) {
        const stackFormatted = notification.stackLabels.map(s => `\`${s}\``).join(' ');
        embed.addFields({
            name: '🛠️ Tecnologias',
            value: stackFormatted,
            inline: false,
        });
    }

    if (notification.requirementBullets.length > 0) {
        embed.addFields({
            name: '📋 Requisitos',
            value: notification.requirementBullets.map(line => `• ${line}`).join('\n'),
            inline: false,
        });
    }

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setLabel('📝 Candidatar-se')
                .setURL(notification.url)
                .setStyle(ButtonStyle.Link),
        );

    return { embeds: [embed], components: [row] };
}

function buildFooter(notification: NotificationJob) {
    const parts = [`${notification.sourceEmoji} ${notification.sourceLabel}`, 'vagas-bot'];
    if (notification.publishedAtLabel) {
        parts.push(`Publicada em ${notification.publishedAtLabel}`);
    }
    return parts.join(' • ');
}

function toBlockQuote(value: string) {
    return value
        .split(/\n+/)
        .map((line) => `> ${line}`)
        .join('\n');
}

// função que constrói e envia o embed (aquela mensagem bonita) para o discord
export async function sendJobDiscord(client: Client, job: JobDTO, channelId: string) {
    try {
        // busca o canal pelo id
        const channel = await client.channels.fetch(channelId);
        if (!channel) throw new Error("canal não encontrado");

        // envia tudo para o canal
        if (!("send" in channel) || typeof channel.send !== "function") {
            throw new Error("canal não aceita envio de mensagens");
        }

        await channel.send(await buildDiscordJobPayload(job) as any);
        console.log(`✅ [discord] vaga enviada: ${job.title}`);
        return true;
    } catch (error) {
        console.error("❌ [discord] erro ao enviar mensagem:", error instanceof Error ? error.message : String(error));
        return false;
    }
}
