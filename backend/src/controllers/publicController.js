const SIP = require("../models/sipSchema");
const News = require("../models/newsSchema");
const Comment = require("../models/commentSchema");

// Listar AIPs públicos (sem autenticação)
exports.getPublicAIPs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      tipo,
      search,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter = { isPublic: true, status: "ingested" };

    if (tipo && tipo !== "all") {
      filter["metadata.tipo"] = tipo;
    }

    if (search) {
      filter.$or = [
        { "metadata.titulo": { $regex: search, $options: "i" } },
        { "metadata.descricao": { $regex: search, $options: "i" } },
        { "metadata.tags": { $in: [new RegExp(search, "i")] } },
        { "metadata.localizacao": { $regex: search, $options: "i" } },
      ];
    }

    const sortOrder = order === "desc" ? -1 : 1;
    const sortField =
      sortBy === "title"
        ? "metadata.titulo"
        : sortBy === "date"
        ? "metadata.dataCreacao"
        : "createdAt";

    const aips = await SIP.find(filter)
      .populate("metadata.produtor", "username avatar")
      .select("-files.path -processingLogs -sipInfo") // Não expor informações sensíveis
      .sort({ [sortField]: sortOrder })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SIP.countDocuments(filter);

    // Estatísticas públicas
    const stats = await SIP.aggregate([
      { $match: { isPublic: true, status: "ingested" } },
      { $group: { _id: "$metadata.tipo", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      aips,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      stats,
    });
  } catch (error) {
    console.error("Error fetching public AIPs:", error);
    res.status(500).json({ error: "Erro ao obter AIPs públicos" });
  }
};

// Obter AIP público por ID
exports.getPublicAIPById = async (req, res) => {
  try {
    const aip = await SIP.findOne({
      _id: req.params.id,
      isPublic: true,
      status: "ingested",
    })
      .populate("metadata.produtor", "username avatar")
      .select("-files.path -processingLogs -sipInfo");

    if (!aip) {
      return res
        .status(404)
        .json({ error: "AIP não encontrado ou não público" });
    }

    // Obter comentários públicos
    const comments = await Comment.find({
      aip: req.params.id,
      isPrivate: false,
      parentComment: null,
    })
      .populate("author", "username avatar")
      .populate({
        path: "replies",
        match: { isPrivate: false },
        populate: { path: "author", select: "username avatar" },
      })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      aip,
      comments,
      totalComments: comments.length,
    });
  } catch (error) {
    console.error("Error fetching public AIP:", error);
    res.status(500).json({ error: "Erro ao obter AIP público" });
  }
};

// Obter ficheiro público de um AIP
exports.getPublicFile = async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const aip = await SIP.findOne({
      _id: id,
      isPublic: true,
      status: "ingested",
    });

    if (!aip) {
      return res
        .status(404)
        .json({ error: "AIP não encontrado ou não público" });
    }

    const file = aip.files.find((f) => f._id.toString() === fileId);

    if (!file) {
      return res.status(404).json({ error: "Ficheiro não encontrado" });
    }

    // Verificar se ficheiro existe
    const fs = require("fs").promises;
    const path = require("path");

    try {
      await fs.access(file.path);
    } catch {
      return res.status(404).json({ error: "Ficheiro não disponível" });
    }

    res.set({
      "Content-Type": file.mimetype,
      "Content-Disposition": `inline; filename="${file.originalName}"`,
    });

    res.sendFile(path.resolve(file.path));
  } catch (error) {
    console.error("Error serving public file:", error);
    res.status(500).json({ error: "Erro ao servir ficheiro" });
  }
};

// Obter notícias públicas
exports.getNews = async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query;

    const news = await News.find({ isVisible: true })
      .populate("author", "username avatar")
      .sort({ publishDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await News.countDocuments({ isVisible: true });

    res.json({
      news,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Erro ao obter notícias" });
  }
};

// Obter estatísticas públicas
exports.getPublicStats = async (req, res) => {
  try {
    // Estatísticas básicas
    const totalPublicAIPs = await SIP.countDocuments({
      isPublic: true,
      status: "ingested",
    });

    // AIPs por tipo
    const typeStats = await SIP.aggregate([
      { $match: { isPublic: true, status: "ingested" } },
      { $group: { _id: "$metadata.tipo", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Timeline dos últimos AIPs
    const recentAIPs = await SIP.find({ isPublic: true, status: "ingested" })
      .select("metadata.titulo metadata.tipo metadata.dataCreacao")
      .populate("metadata.produtor", "username")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalPublicAIPs,
      typeStats,
      recentAIPs,
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
};

module.exports = exports;
