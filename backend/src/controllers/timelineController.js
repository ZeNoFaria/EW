const SIP = require("../models/sipSchema");
const Taxonomy = require("../models/taxonomySchema");

// Obter eventos da timeline
exports.getTimelineEvents = async (req, res) => {
  try {
    const {
      year,
      month,
      startDate,
      endDate,
      category,
      type,
      limit = 20,
      page = 1,
    } = req.query;

    let dateFilter = {};
    let categoryFilter = {};

    // Filtro por data
    if (year && month) {
      dateFilter = {
        "metadata.dataCreacao": {
          $gte: new Date(year, month - 1, 1),
          $lt: new Date(year, month, 1),
        },
      };
    } else if (startDate && endDate) {
      dateFilter = {
        "metadata.dataCreacao": {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    } else if (year) {
      dateFilter = {
        "metadata.dataCreacao": {
          $gte: new Date(year, 0, 1),
          $lt: new Date(parseInt(year) + 1, 0, 1),
        },
      };
    }

    // Filtro por categoria
    if (category) {
      categoryFilter = {
        $or: [
          { "metadata.tipo": category },
          { "metadata.tags": { $in: [category] } },
        ],
      };
    }

    // Filtro de privacidade
    let privacyFilter = {};
    if (req.user) {
      privacyFilter = {
        $or: [{ isPublic: true }, { "metadata.produtor": req.user._id }],
      };
    } else {
      privacyFilter = { isPublic: true };
    }

    const events = await SIP.find({
      ...dateFilter,
      ...categoryFilter,
      ...privacyFilter,
    })
      .populate("metadata.produtor", "username avatar")
      .populate("metadata.tipo", "name color icon")
      .populate("metadata.tags", "name color")
      .sort({ "metadata.dataCreacao": -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SIP.countDocuments({
      ...dateFilter,
      ...categoryFilter,
      ...privacyFilter,
    });

    // Agrupar por data para melhor visualização
    const groupedEvents = {};
    events.forEach((event) => {
      const dateKey = event.metadata.dataCreacao.toISOString().split("T")[0];
      if (!groupedEvents[dateKey]) {
        groupedEvents[dateKey] = [];
      }
      groupedEvents[dateKey].push(event);
    });

    res.json({
      events: groupedEvents,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Error fetching timeline:", error);
    res.status(500).json({ error: "Erro ao obter timeline" });
  }
};

// Obter estatísticas da timeline
exports.getTimelineStats = async (req, res) => {
  try {
    let filter = {};

    if (req.user) {
      filter = {
        $or: [{ isPublic: true }, { "metadata.produtor": req.user._id }],
      };
    } else {
      filter = { isPublic: true };
    }

    // Estatísticas por mês
    const monthlyStats = await SIP.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: "$metadata.dataCreacao" },
            month: { $month: "$metadata.dataCreacao" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    // Estatísticas por categoria
    const categoryStats = await SIP.aggregate([
      { $match: filter },
      { $unwind: "$metadata.tags" },
      {
        $group: {
          _id: "$metadata.tags",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "taxonomies",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      monthlyStats,
      categoryStats,
    });
  } catch (error) {
    console.error("Error fetching timeline stats:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
};

// Pesquisar na timeline
exports.searchTimeline = async (req, res) => {
  try {
    const { q, limit = 10, page = 1 } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Query de pesquisa é obrigatória" });
    }

    let filter = {
      $text: { $search: q },
    };

    if (req.user) {
      filter = {
        ...filter,
        $or: [{ isPublic: true }, { "metadata.produtor": req.user._id }],
      };
    } else {
      filter.isPublic = true;
    }

    const results = await SIP.find(filter, { score: { $meta: "textScore" } })
      .populate("metadata.produtor", "username avatar")
      .populate("metadata.tipo", "name color icon")
      .populate("metadata.tags", "name color")
      .sort({ score: { $meta: "textScore" } })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SIP.countDocuments(filter);

    res.json({
      results,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("Error searching timeline:", error);
    res.status(500).json({ error: "Erro na pesquisa" });
  }
};

module.exports = {
  getTimelineEvents: exports.getTimelineEvents,
  getTimelineStats: exports.getTimelineStats,
  searchTimeline: exports.searchTimeline,
};
