// src/models/vaga.js
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const vagaSchema = new Schema(
  {
    source: {
      type: String,
      required: true,
      enum: ["linkedin", "indeed", "gupy", "remotar"],
    },

    externalId: {
      type: String,
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    company: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      default: null,
      trim: true,
    },

    workMode: {
      type: String,
      enum: ["remote", "hybrid", "onsite", "unknown"],
      default: "unknown",
    },

    seniority: {
      type: String,
      enum: ["intern", "junior", "mid", "senior", "unknown"],
      default: "unknown",
    },

    url: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    description: {
      type: String,
      default: null,
      trim: true,
    },

    stack: {
      type: [String],
      default: [],
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    scrapedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    contentHash: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
    collection: "jobs",
  }
);

// =========================
// Índices de unicidade/dedupe
// =========================
vagaSchema.index(
  { source: 1, externalId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalId: { $type: "string" },
    },
  }
);

// =========================
// Índices para filtros
// =========================
vagaSchema.index({ stack: 1, workMode: 1, seniority: 1 });
vagaSchema.index({ source: 1, scrapedAt: -1 });
vagaSchema.index({ company: 1 });
vagaSchema.index({ createdAt: -1 });
vagaSchema.index({ publishedAt: -1 });

// =========================
// Busca textual
// =========================
vagaSchema.index({
  title: "text",
  company: "text",
  description: "text",
});

export const VagaModel = models.Vaga || model("Vaga", vagaSchema);

export default VagaModel;
