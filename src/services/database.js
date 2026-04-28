import mongoose from "mongoose";
import "dotenv/config";

let connectionPromise = null;

const MONGO_OPTIONS = {
  dbName: "vagas-bot",

  // evita travar muito tempo tentando conectar
  serverSelectionTimeoutMS: 5000,

  // tempo máximo para operações aguardarem resposta
  socketTimeoutMS: 20000,

  // controle de conexões
  maxPoolSize: 5,
  minPoolSize: 1,

  // evita comandos infinitamente pendurados se desconectar
  bufferCommands: false,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectDatabase({ retries = 5, delayMs = 2000 } = {}) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGO_DATA;

  if (!uri) {
    throw new Error("❌ MONGO_DATA não definido no .env");
  }

  connectionPromise = connectWithRetry(uri, retries, delayMs);

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

async function connectWithRetry(uri, retries, delayMs) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, MONGO_OPTIONS);

      console.log("✅ Mongo conectado");

      setupMongoEvents();

      return mongoose.connection;
    } catch (error) {
      lastError = error;

      console.error(
        `❌ Falha ao conectar no MongoDB (${attempt}/${retries}):`,
        error.message,
      );

      if (attempt < retries) {
        await sleep(delayMs * attempt);
      }
    }
  }

  throw lastError;
}

let eventsRegistered = false;

function setupMongoEvents() {
  if (eventsRegistered) return;

  eventsRegistered = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ Mongo desconectado");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("🔁 Mongo reconectado");
  });

  mongoose.connection.on("error", (error) => {
    console.error("❌ Erro na conexão Mongo:", error.message);
  });
}

export function getConnection() {
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("🔌 Mongo desconectado manualmente");
  }
}
