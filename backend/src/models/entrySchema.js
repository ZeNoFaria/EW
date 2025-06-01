const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    images: [String],
    // ADICIONAR ESTE CAMPO
    isPublic: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  { timestamps: true }
);

// Adicionar índices para melhor performance
entrySchema.index({ date: -1 });
entrySchema.index({ author: 1 });
entrySchema.index({ isPublic: 1 });
entrySchema.index({ category: 1 });

module.exports = mongoose.model("Entry", entrySchema);
