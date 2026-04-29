import express from "express";
import "dotenv/config";
import rateLimit from "express-rate-limit";

import vagaRoutes from "./routes/vagaRoutes.js";
import { connectDatabase } from "#root/services/database.js";

const app = express();

app.use(express.json());

// rate limit
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 120,            // 120 req por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Muitas requisições. Tente novamente em instantes.",
    },
  })
);

// rotas
app.use("/", vagaRoutes);

// start
const PORT = process.env.PORT || 3000;

async function start() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
  });
}

start();
