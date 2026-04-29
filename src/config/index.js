import 'dotenv/config';

// arquivo central de configurações que lê as variáveis do .env
export const config = {
    port: process.env.PORT || 3000, // porta onde o servidor vai rodar
    whatsapp: {
        groupId: process.env.WHATSAPP_GROUP_ID || '120363406857942739@g.us', // id do grupo que recebe as vagas
        authMethod: process.env.AUTH_METHOD || 'code', // método de login: qr ou code
        mobileNumber: process.env.MOBILE_NUMBER // seu número de telefone
    },
    discord: {
        token: process.env.DISCORD_TOKEN, // token secreto do bot do discord
        channelId: process.env.DISCORD_CHANNEL_ID, // id do canal onde as vagas são postadas
    },
    webhook: {
        url: process.env.WEBHOOK_URL || `http://localhost:3000/webhook/nova-vaga` // endereço para onde o scraper manda as vagas
    },
    database: {
        uri: process.env.MONGODB_URI // url do banco de dados (mongo/mongoose)
    }
};

