// arquivo central de configurações que lê as variáveis do .env
export const config = {
    port: process.env.PORT || 3000, // porta onde o servidor vai rodar (o render define isso automaticamente)
    whatsapp: {
        groupId: process.env.WHATSAPP_GROUP_ID || '120363406857942739@g.us',
        authMethod: process.env.AUTH_METHOD || 'code',
        mobileNumber: process.env.MOBILE_NUMBER
    },
    discord: {
        token: process.env.DISCORD_TOKEN,
        channelId: process.env.DISCORD_CHANNEL_ID,
    },
    webhook: {
        // gera a url do webhook dinamicamente com base na porta atual
        url: process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}/webhook/nova-vaga`
    },
    database: {
        uri: process.env.MONGODB_URI
    }
};


