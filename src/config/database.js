import mongoose from 'mongoose';
import { config } from './index.js';

// função para conectar ao mongodb
export async function connectDB() {
    try {
        if (!config.database.uri) {
            console.log("⚠️ [DATABASE] MONGODB_URI não encontrada no .env. Rodando sem banco de dados (deduplicação desativada).");
            return;
        }

        await mongoose.connect(config.database.uri);
        console.log("✅ [DATABASE] MongoDB Conectado!");
    } catch (err) {
        console.error("❌ [DATABASE] Erro ao conectar ao MongoDB:", err.message);
        process.exit(1); // encerra o processo se não conseguir conectar ao banco crítico
    }
}
