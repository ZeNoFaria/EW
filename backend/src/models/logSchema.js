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
        "create",
        "read",
        "search",
        "share",
        "logout",
        "error",
        "admin_action",
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
      enum: [
        "sip",
        "aip",
        "dip",
        "user",
        "news",
        "comment",
        "entry",
        "category",
        "tag",
        "auth",
        "admin",
        "system",
        "page",
        "api",
        "file",
        "other",
      ],
      default: "other", // Changed from "aip" to "other" to avoid unknown errors
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
logSchema.index({ resourceType: 1, createdAt: -1 });

module.exports = mongoose.model("Log", logSchema);
