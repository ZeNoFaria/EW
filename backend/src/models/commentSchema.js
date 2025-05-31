const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    aip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SIP",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    isPrivate: {
      type: Boolean,
      default: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    replies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index para melhor performance
commentSchema.index({ aip: 1, createdAt: -1 });
commentSchema.index({ author: 1 });

module.exports = mongoose.model("Comment", commentSchema);
