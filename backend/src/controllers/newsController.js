const News = require("../models/newsSchema");

// Criar notícia
exports.createNews = async (req, res) => {
  try {
    const {
      title,
      content,
      summary,
      category,
      tags,
      isPublic = true,
    } = req.body;

    const news = new News({
      title,
      content,
      summary,
      category,
      tags,
      isPublic,
      author: req.user._id,
    });

    await news.save();
    await news.populate("author", "username avatar");
    await news.populate("category", "name color");

    res.status(201).json(news);
  } catch (error) {
    console.error("Error creating news:", error);
    res.status(500).json({ error: "Erro ao criar notícia" });
  }
};

// Listar notícias
exports.getAllNews = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, isPublic } = req.query;

    let filter = {};

    // Filtro por categoria
    if (category) {
      filter.category = category;
    }

    // Filtro de privacidade
    if (req.user && req.user.role === "admin") {
      if (isPublic !== undefined) {
        filter.isPublic = isPublic === "true";
      }
    } else if (req.user) {
      filter = {
        ...filter,
        $or: [{ isPublic: true }, { author: req.user._id }],
      };
    } else {
      filter.isPublic = true;
    }

    const news = await News.find(filter)
      .populate("author", "username avatar")
      .populate("category", "name color")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await News.countDocuments(filter);

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

// Obter notícia por ID
exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;

    const news = await News.findById(id)
      .populate("author", "username avatar")
      .populate("category", "name color");

    if (!news) {
      return res.status(404).json({ error: "Notícia não encontrada" });
    }

    // Verificar permissões
    if (
      !news.isPublic &&
      req.user.role !== "admin" &&
      !news.author.equals(req.user._id)
    ) {
      return res
        .status(403)
        .json({ error: "Sem permissão para ver esta notícia" });
    }

    // Incrementar visualizações
    await News.findByIdAndUpdate(id, { $inc: { views: 1 } });

    res.json(news);
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Erro ao obter notícia" });
  }
};

// Atualizar notícia
exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const news = await News.findById(id);

    if (!news) {
      return res.status(404).json({ error: "Notícia não encontrada" });
    }

    // Verificar permissões
    if (req.user.role !== "admin" && !news.author.equals(req.user._id)) {
      return res
        .status(403)
        .json({ error: "Sem permissão para editar esta notícia" });
    }

    const updatedNews = await News.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate("author", "username avatar")
      .populate("category", "name color");

    res.json(updatedNews);
  } catch (error) {
    console.error("Error updating news:", error);
    res.status(500).json({ error: "Erro ao atualizar notícia" });
  }
};

// Eliminar notícia
exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;

    const news = await News.findById(id);

    if (!news) {
      return res.status(404).json({ error: "Notícia não encontrada" });
    }

    // Verificar permissões
    if (req.user.role !== "admin" && !news.author.equals(req.user._id)) {
      return res
        .status(403)
        .json({ error: "Sem permissão para eliminar esta notícia" });
    }

    await News.findByIdAndDelete(id);

    res.json({ message: "Notícia eliminada com sucesso" });
  } catch (error) {
    console.error("Error deleting news:", error);
    res.status(500).json({ error: "Erro ao eliminar notícia" });
  }
};

module.exports = {
  createNews: exports.createNews,
  getAllNews: exports.getAllNews,
  getNewsById: exports.getNewsById,
  updateNews: exports.updateNews,
  deleteNews: exports.deleteNews,
};
