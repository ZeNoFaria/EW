const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    excerpt: {
      type: String,
      maxlength: 300,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isVisible: {
      type: Boolean,
      default: false,
    },
    publishDate: {
      type: Date,
      default: Date.now,
    },
    tags: [String],
    featuredImage: String,
    slug: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug before saving
newsSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
  next();
});

newsSchema.index({ isVisible: 1, publishDate: -1 });

module.exports = mongoose.model("News", newsSchema);
