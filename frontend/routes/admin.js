var express = require("express");
var router = express.Router();
var axios = require("axios");

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

const siteConfig = {
  siteName: "My Digital Diary",
  title: "Digital Diary",
};

// Navigation items (match the main navigation)
const navItems = [
  { text: "Homepage", url: "/", active: false },
  { text: "Timeline", url: "/timeline", active: false },
  { text: "Categories", url: "/categories", active: false },
  { text: "About", url: "/about", active: false },
];

const getNavWithActive = (activeUrl) => {
  return navItems.map((item) => ({
    ...item,
    active: item.url === activeUrl,
  }));
};

// Middleware to check admin access
router.use((req, res, next) => {
  if (!req.session.token || !req.session.user?.isAdmin) {
    return res.redirect("/auth/login?error=Admin access required");
  }
  res.locals.user = req.session.user;
  res.locals.isAuthenticated = true;
  next();
});

// Main admin dashboard (route: /admin)
router.get("/", async (req, res) => {
  try {
    // ATUALIZADO - Usar endpoints corretos da API
    const [statsResponse, usersResponse] = await Promise.all([
      axios
        .get(`${API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${req.session.token}` },
        })
        .catch(() => ({ data: {} })),
      axios
        .get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${req.session.token}` },
        })
        .catch(() => ({ data: [] })),
    ]);

    const stats = statsResponse.data || {
      totalEntries: 0,
      totalUsers: 0,
      totalAips: 0,
      publicEntries: 0,
      totalComments: 0,
    };

    const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];

    res.render("admin-dashboard", {
      ...siteConfig,
      title: "Admin Dashboard - Digital Diary",
      navItems: getNavWithActive(null),
      stats: {
        overview: {
          totalEntries: stats.totalEntries || 0,
          totalUsers: users.length,
          totalAips: stats.totalAips || 0,
          publicEntries: stats.publicEntries || 0,
          totalComments: stats.totalComments || 0,
        },
        recentEntries: stats.recentEntries || [],
      },
      users: users.slice(0, 10), // Show only first 10 users
    });
  } catch (err) {
    console.error("Error loading admin dashboard:", err.message);

    res.render("admin-dashboard", {
      ...siteConfig,
      title: "Admin Dashboard - Digital Diary",
      navItems: getNavWithActive(null),
      stats: {
        overview: {
          totalEntries: 0,
          totalUsers: 0,
          totalAips: 0,
          publicEntries: 0,
          totalComments: 0,
        },
        recentEntries: [],
      },
      users: [],
      error: "Error loading dashboard data",
    });
  }
});

// Users management
router.get("/users", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${req.session.token}` },
    });

    res.render("admin-users", {
      ...siteConfig,
      title: "User Management - Admin",
      navItems: getNavWithActive(null),
      users: response.data,
    });
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message: "Error loading users",
      error: { status: 500 },
    });
  }
});

// Update user role - ATUALIZADO para usar endpoint correto
router.post("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;

    await axios.put(
      `${API_URL}/api/users/${req.params.id}/role`,
      { role },
      { headers: { Authorization: `Bearer ${req.session.token}` } }
    );

    res.redirect("/admin/users?message=User role updated successfully");
  } catch (err) {
    console.error("Error updating user role:", err.message);
    res.redirect("/admin/users?error=Error updating user role");
  }
});

// NOVO - Detailed stats page
router.get("/stats", async (req, res) => {
  try {
    const period = req.query.period || "month";

    const [detailedStatsResponse, exportResponse] = await Promise.all([
      axios
        .get(`${API_URL}/api/admin/stats/detailed`, {
          params: { period },
          headers: { Authorization: `Bearer ${req.session.token}` },
        })
        .catch(() => ({ data: {} })),
      axios
        .get(`${API_URL}/api/admin/stats/export`, {
          params: { type: "general", format: "json" },
          headers: { Authorization: `Bearer ${req.session.token}` },
        })
        .catch(() => ({ data: {} })),
    ]);

    const stats = detailedStatsResponse.data || {};

    res.render("admin-stats", {
      ...siteConfig,
      title: "Detailed Statistics - Admin",
      navItems: getNavWithActive(null),
      stats,
      period,
      exportData: exportResponse.data,
    });
  } catch (err) {
    console.error("Error fetching detailed stats:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message: "Error loading statistics",
      error: { status: 500 },
    });
  }
});

// NOVO - Export stats
router.get("/export", async (req, res) => {
  try {
    const { type = "general", format = "json" } = req.query;

    const response = await axios.get(`${API_URL}/api/admin/stats/export`, {
      params: { type, format },
      headers: { Authorization: `Bearer ${req.session.token}` },
      responseType: format === "csv" ? "stream" : "json",
    });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="stats-${type}-${Date.now()}.csv"`
      );
      response.data.pipe(res);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="stats-${type}-${Date.now()}.json"`
      );
      res.json(response.data);
    }
  } catch (err) {
    console.error("Error exporting stats:", err.message);
    res.redirect("/admin/stats?error=Error exporting statistics");
  }
});

module.exports = router;
