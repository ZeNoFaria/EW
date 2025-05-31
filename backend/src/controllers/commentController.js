const Comment = require("../models/commentSchema");
const SIP = require("../models/sipSchema");

// Criar comentário
exports.createComment = async (req, res) => {
  try {
    const { aipId } = req.params;
    const { content, isPrivate = true, parentComment } = req.body;

    // Verificar se AIP existe
    const aip = await SIP.findById(aipId);
    if (!aip) {
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões para AIP privado
    if (
      !aip.isPublic &&
      req.user.role !== "admin" &&
      !aip.metadata.produtor.equals(req.user._id)
    ) {
      return res
        .status(403)
        .json({ error: "Sem permissão para comentar neste AIP" });
    }

    const comment = new Comment({
      aip: aipId,
      author: req.user._id,
      content,
      isPrivate,
      parentComment,
    });

    await comment.save();
    await comment.populate("author", "username email");

    // Se é resposta, adicionar à lista de replies do comentário pai
    if (parentComment) {
      await Comment.findByIdAndUpdate(parentComment, {
        $push: { replies: comment._id },
      });
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Erro ao criar comentário" });
  }
};

// Listar comentários de um AIP
exports.getCommentsByAIP = async (req, res) => {
  try {
    const { aipId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verificar se AIP existe
    const aip = await SIP.findById(aipId);
    if (!aip) {
      return res.status(404).json({ error: "AIP não encontrado" });
    }

    // Verificar permissões
    let filter = { aip: aipId, parentComment: null }; // Só comentários principais

    if (
      !aip.isPublic &&
      req.user.role !== "admin" &&
      !aip.metadata.produtor.equals(req.user._id)
    ) {
      return res
        .status(403)
        .json({ error: "Sem permissão para ver comentários" });
    }

    // Se não é o dono nem admin, só vê comentários públicos
    if (
      req.user.role !== "admin" &&
      !aip.metadata.produtor.equals(req.user._id)
    ) {
      filter.isPrivate = false;
    }

    const comments = await Comment.find(filter)
      .populate("author", "username email avatar")
      .populate({
        path: "replies",
        populate: { path: "author", select: "username email avatar" },
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Comment.countDocuments(filter);

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Erro ao obter comentários" });
  }
};

// Atualizar comentário
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isPrivate } = req.body;

    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }

    // Verificar permissões
    if (req.user.role !== "admin" && !comment.author.equals(req.user._id)) {
      return res
        .status(403)
        .json({ error: "Sem permissão para editar este comentário" });
    }

    comment.content = content || comment.content;
    comment.isPrivate = isPrivate !== undefined ? isPrivate : comment.isPrivate;

    await comment.save();
    await comment.populate("author", "username email avatar");

    res.json(comment);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Erro ao atualizar comentário" });
  }
};

// Eliminar comentário
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }

    // Verificar permissões
    if (req.user.role !== "admin" && !comment.author.equals(req.user._id)) {
      return res
        .status(403)
        .json({ error: "Sem permissão para eliminar este comentário" });
    }

    // Eliminar também replies
    await Comment.deleteMany({ parentComment: id });

    // Remover das replies do comentário pai
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: id },
      });
    }

    await Comment.findByIdAndDelete(id);

    res.json({ message: "Comentário eliminado com sucesso" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Erro ao eliminar comentário" });
  }
};

module.exports = exports;
