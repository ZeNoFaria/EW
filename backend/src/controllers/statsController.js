const Log = require("../models/logSchema");
const SIP = require("../models/sipSchema");
const User = require("../models/userSchema");
const Comment = require("../models/commentSchema");

// Obter estatísticas gerais (admin only)
exports.getGeneralStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Estatísticas gerais
    const totalUsers = await User.countDocuments();
    const totalAIPs = await SIP.countDocuments();
    const publicAIPs = await SIP.countDocuments({ isPublic: true });
    const totalComments = await Comment.countDocuments();

    // Logs por ação
    const actionStats = await Log.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // AIPs mais visualizados
    const mostViewed = await Log.aggregate([
      {
        $match: { action: "view", resource: { $exists: true }, ...dateFilter },
      },
      { $group: { _id: "$resource", views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "sips",
          localField: "_id",
          foreignField: "_id",
          as: "aip",
        },
      },
      { $unwind: "$aip" },
      {
        $project: {
          views: 1,
          title: "$aip.metadata.titulo",
          tipo: "$aip.metadata.tipo",
          isPublic: "$aip.isPublic",
        },
      },
    ]);

    // Uploads por mês
    const uploadsByMonth = await SIP.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Utilizadores mais ativos
    const activeUsers = await Log.aggregate([
      { $match: { user: { $exists: true }, ...dateFilter } },
      { $group: { _id: "$user", actions: { $sum: 1 } } },
      { $sort: { actions: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          actions: 1,
          username: "$user.username",
          email: "$user.email",
        },
      },
    ]);

    res.json({
      overview: {
        totalUsers,
        totalAIPs,
        publicAIPs,
        privateAIPs: totalAIPs - publicAIPs,
        totalComments,
      },
      actionStats,
      mostViewed,
      uploadsByMonth,
      activeUsers,
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
};

// Estatísticas detalhadas por período
exports.getDetailedStats = async (req, res) => {
  try {
    const { period = "month" } = req.query; // day, week, month, year

    let groupBy;
    switch (period) {
      case "day":
        groupBy = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
        break;
      case "week":
        groupBy = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        };
        break;
      case "year":
        groupBy = {
          year: { $year: "$createdAt" },
        };
        break;
      default: // month
        groupBy = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
    }

    // Atividade por período
    const activityByPeriod = await Log.aggregate([
      {
        $group: {
          _id: { period: groupBy, action: "$action" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.period": 1 } },
    ]);

    // Tipos de AIP mais populares
    const topAIPTypes = await SIP.aggregate([
      { $group: { _id: "$metadata.tipo", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Distribuição de AIPs por utilizador
    const aipsPerUser = await SIP.aggregate([
      { $group: { _id: "$metadata.produtor", count: { $sum: 1 } } },
      { $group: { _id: "$count", users: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      activityByPeriod,
      topAIPTypes,
      aipsPerUser,
    });
  } catch (error) {
    console.error("Detailed stats error:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas detalhadas" });
  }
};

// Exportar estatísticas como CSV
exports.exportStats = async (req, res) => {
  try {
    const { type = "general", format = "json" } = req.query;

    let data;

    switch (type) {
      case "logs":
        data = await Log.find()
          .populate("user", "username email")
          .populate("resource")
          .sort({ createdAt: -1 })
          .limit(1000);
        break;

      case "aips":
        data = await SIP.find()
          .populate("metadata.produtor", "username email")
          .select("metadata status isPublic createdAt files")
          .sort({ createdAt: -1 });
        break;

      default:
        return res.status(400).json({ error: "Tipo de export inválido" });
    }

    if (format === "csv") {
      // Implementar conversão para CSV se necessário
      const csv = convertToCSV(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}-stats.csv"`
      );
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error("Export stats error:", error);
    res.status(500).json({ error: "Erro ao exportar estatísticas" });
  }
};

// Função auxiliar para converter para CSV (simples)
const convertToCSV = (data) => {
  if (!data.length) return "";

  const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
  const csvHeaders = headers.join(",");

  const csvRows = data.map((item) => {
    const obj = item.toObject ? item.toObject() : item;
    return headers
      .map((header) => {
        const value = obj[header];
        return typeof value === "string" ? `"${value}"` : value;
      })
      .join(",");
  });

  return [csvHeaders, ...csvRows].join("\n");
};

// Estatísticas de utilizador individual
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const userStats = await Log.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
          lastActivity: { $max: "$createdAt" },
        },
      },
    ]);

    const totalAIPs = await SIP.countDocuments({
      "metadata.produtor": userId,
    });

    res.json({
      userStats,
      totalAIPs,
      userId,
    });
  } catch (error) {
    console.error("User stats error:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas do utilizador" });
  }
};

module.exports = exports;
