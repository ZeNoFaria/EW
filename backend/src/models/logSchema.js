const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "view",
        "download",
        "upload",
        "login",
        "register",
        "export",
        "delete",
        "update",
      ],
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SIP",
    },
    resourceType: {
      type: String,
      enum: ["sip", "aip", "dip", "user", "news", "comment"],
      default: "aip",
    },
    ip: String,
    userAgent: String,
    sessionId: String,
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    success: {
      type: Boolean,
      default: true,
    },
    errorMessage: String,
  },
  {
    timestamps: true,
  }
);

// TTL index - logs expiram após 1 ano
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

// Indexes para queries de estatísticas
logSchema.index({ action: 1, createdAt: -1 });
logSchema.index({ user: 1, createdAt: -1 });
logSchema.index({ resource: 1, action: 1 });

module.exports = mongoose.model("Log", logSchema);
