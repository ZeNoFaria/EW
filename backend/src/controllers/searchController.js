// backend/src/controllers/searchController.js
const SIP = require("../models/sipSchema");

exports.searchAIPs = async (req, res) => {
  try {
    const { q, tipo, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Query de pesquisa é obrigatória" });
    }

    const filter = {
      status: "ingested",
      $or: [
        { "metadata.titulo": { $regex: q, $options: "i" } },
        { "metadata.descricao": { $regex: q, $options: "i" } },
        { "metadata.localizacao": { $regex: q, $options: "i" } },
      ],
    };

    if (tipo) {
      filter["metadata.tipo"] = tipo;
    }

    // Se não for admin, só mostra públicos ou próprios
    if (req.user.role !== "admin") {
      filter.$and = [
        filter.$or,
        {
          $or: [{ isPublic: true }, { "metadata.produtor": req.user._id }],
        },
      ];
      delete filter.$or;
    }

    const aips = await SIP.find(filter)
      .populate("metadata.produtor", "username email")
      .populate("metadata.tipo", "name slug color icon")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SIP.countDocuments(filter);

    res.json({
      results: aips,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      query: q,
    });
  } catch (error) {
    console.error("Erro na pesquisa:", error);
    res.status(500).json({ error: "Erro na pesquisa" });
  }
};
