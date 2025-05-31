const mongoose = require("mongoose");

const taxonomySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Taxonomy" },
    level: { type: Number, default: 0 },
    color: { type: String, default: "#007bff" }, // Para UI
    icon: String, // FontAwesome icon class
    isActive: { type: Boolean, default: true },
    orderIndex: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Índices para performance
taxonomySchema.index({ parent: 1 });
taxonomySchema.index({ level: 1 });
taxonomySchema.index({ slug: 1 });

module.exports = mongoose.model("Taxonomy", taxonomySchema);
