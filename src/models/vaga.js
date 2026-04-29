import mongoose from 'mongoose';

// esquema da vaga para o mongodb
const VagaSchema = new mongoose.Schema({
    title: { type: String, required: true }, // título da vaga
    company: { type: String, required: true }, // nome da empresa
    description: String, // descrição completa
    location: { type: String, default: 'não informado' }, // localidade
    url: { type: String, required: true, unique: true }, // link único da vaga
    source: String, // fonte (remotar, gupy, linkedin)
    externalId: String, // id da vaga na plataforma de origem
    workMode: { type: String, default: 'onsite' }, // remoto, híbrido, presencial
    seniority: { type: String, default: 'n/a' }, // senioridade
    stack: [String], // lista de tecnologias
    originalLanguage: { type: String, default: 'en' }, // idioma original para as bandeiras
    contentHash: { type: String, unique: true }, // hash para evitar duplicidade de conteúdo
    sent_whatsapp: { type: Boolean, default: false }, // se já foi enviada para o whatsapp
    sent_discord: { type: Boolean, default: false }, // se já foi enviada para o discord
    scrapedAt: { type: Date, default: Date.now }, // data de quando foi capturada
    publishedAt: Date, // data de quando foi publicada na origem
    createdAt: { type: Date, default: Date.now } // data de criação no nosso banco
});

// cria índices de busca por texto para o título e descrição
VagaSchema.index({ title: 'text', description: 'text', company: 'text' });

const VagaModel = mongoose.models.Vaga || mongoose.model('Vaga', VagaSchema);

export default VagaModel;
