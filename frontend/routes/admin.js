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
    // Use endpoints that exist - get basic stats from entries and users
    const [entriesResponse, usersResponse] = await Promise.all([
      axios.get(`${API_URL}/api/entries`).catch(() => ({ data: [] })),
      axios
        .get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${req.session.token}` },
        })
        .catch(() => ({ data: [] })),
    ]);

    const entries = Array.isArray(entriesResponse.data)
      ? entriesResponse.data
      : entriesResponse.data.entries || [];

    const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];

    // Calculate basic stats
    const stats = {
      overview: {
        totalEntries: entries.length,
        totalUsers: users.length,
        publicEntries: entries.filter((entry) => entry.isPublic).length,
        totalComments: 0, // Will be calculated if we have comments
      },
      recentEntries: entries.slice(0, 5).map((entry) => ({
        id: entry._id,
        title: entry.title,
        date: entry.date
          ? new Date(entry.date).toLocaleDateString()
          : "No date",
        author: entry.author?.username || "Unknown",
      })),
    };

    res.render("admin-dashboard", {
      ...siteConfig,
      title: "Admin Dashboard - Digital Diary",
      navItems: getNavWithActive(null),
      stats,
      users: users.slice(0, 10), // Show only first 10 users
    });
  } catch (err) {
    console.error("Error loading admin dashboard:", err.message);

    // Render with minimal data in case of errors
    res.render("admin-dashboard", {
      ...siteConfig,
      title: "Admin Dashboard - Digital Diary",
      navItems: getNavWithActive(null),
      stats: {
        overview: {
          totalEntries: 0,
          totalUsers: 0,
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

// Update user role
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

// Basic stats page
router.get("/stats", async (req, res) => {
  try {
    const [entriesResponse, usersResponse] = await Promise.all([
      axios.get(`${API_URL}/api/entries`).catch(() => ({ data: [] })),
      axios
        .get(`${API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${req.session.token}` },
        })
        .catch(() => ({ data: [] })),
    ]);

    const entries = Array.isArray(entriesResponse.data)
      ? entriesResponse.data
      : entriesResponse.data.entries || [];

    const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];

    // Group entries by month for trends
    const entriesByMonth = {};
    entries.forEach((entry) => {
      const date = new Date(entry.date || entry.createdAt);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      entriesByMonth[monthKey] = (entriesByMonth[monthKey] || 0) + 1;
    });

    // Extract tags for stats
    const tagCounts = {};
    entries.forEach((entry) => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach((tag) => {
          const tagName = typeof tag === "string" ? tag : tag.name;
          if (tagName) {
            tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
          }
        });
      }
    });

    const stats = {
      overview: {
        totalEntries: entries.length,
        totalUsers: users.length,
        totalTags: Object.keys(tagCounts).length,
        avgEntriesPerUser:
          users.length > 0
            ? Math.round((entries.length / users.length) * 10) / 10
            : 0,
      },
      entriesByMonth: Object.entries(entriesByMonth)
        .map(([month, count]) => ({
          month,
          count,
        }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12),
      topTags: Object.entries(tagCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recentUsers: users
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10),
    };

    res.render("admin-stats", {
      ...siteConfig,
      title: "Detailed Statistics - Admin",
      navItems: getNavWithActive(null),
      stats,
      period: req.query.period || "month",
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

module.exports = router;
