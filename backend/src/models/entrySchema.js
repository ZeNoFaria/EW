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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entry", entrySchema);
