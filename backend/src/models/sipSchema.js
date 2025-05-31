const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  path: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  checksum: String,
});

const sipSchema = new mongoose.Schema(
  {
    // Metadados do manifesto
    metadata: {
      dataCreacao: { type: Date, required: true },
      dataSubmissao: { type: Date, default: Date.now },
      produtor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      submitter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      titulo: { type: String, required: true },
      tipo: {
        type: String,
        enum: [
          "foto",
          "jantar",
          "passeio",
          "viagem",
          "treino",
          "academico",
          "trabalho",
          "pessoal",
        ],
        required: true,
      },
      descricao: String,
      localizacao: String,
      tags: [String],
    },

    // Estado do pacote
    status: {
      type: String,
      enum: ["pending", "processing", "ingested", "failed"],
      default: "pending",
    },

    // Ficheiros do pacote
    files: [fileSchema],

    // Informação do SIP original
    sipInfo: {
      originalFilename: String,
      uploadDate: { type: Date, default: Date.now },
      manifestoValid: { type: Boolean, default: false },
    },

    // Configurações de visibilidade
    isPublic: { type: Boolean, default: false },

    // Logs de processamento
    processingLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        level: { type: String, enum: ["info", "warning", "error"] },
        message: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SIP", sipSchema);
