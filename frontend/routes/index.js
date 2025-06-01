var express = require("express");
var router = express.Router();
var axios = require("axios");

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// Site configuration
const siteConfig = {
  siteName: "My Digital Diary",
  title: "Digital Diary",
};

// Navigation items (removed Tags)
const navItems = [
  { text: "Homepage", url: "/", active: false },
  { text: "Timeline", url: "/timeline", active: false },
  { text: "Categories", url: "/categories", active: false },
  { text: "About", url: "/about", active: false },
];

// Helper function to set active navigation item
const getNavWithActive = (activeUrl) => {
  return navItems.map((item) => ({
    ...item,
    active: item.url === activeUrl,
  }));
};

// Helper function to format entries with consistent tag structure
const formatEntries = (entries, tagAsString = false) => {
  return entries.map((entry) => ({
    ...entry,
    id: entry._id || entry.id,
    date: entry.date ? new Date(entry.date).toLocaleDateString() : "No date",
    excerpt: entry.content
      ? entry.content.substring(0, 150) + "..."
      : "No content",
    tags: tagAsString
      ? (entry.tags || []).map((tag) =>
          typeof tag === "string" ? tag : tag.name || tag
        )
      : entry.tags || [],
  }));
};

// Helper function to extract all tags from entries
const extractAllTags = (entries) => {
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

  return Object.entries(tagCounts)
    .map(([name, count]) => ({
      name,
      count,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    }))
    .sort((a, b) => b.count - a.count);
};

// Middleware to make user info available
router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.token;
  next();
});

/* GET home page. */
router.get("/", async function (req, res, next) {
  try {
    const [entriesResponse, categoriesResponse] = await Promise.all([
      axios.get(`${API_URL}/api/entries`).catch(() => ({ data: [] })),
      axios.get(`${API_URL}/api/categories`).catch(() => ({ data: [] })),
    ]);

    const entries = Array.isArray(entriesResponse.data)
      ? entriesResponse.data
      : entriesResponse.data.entries || [];
    const categories = Array.isArray(categoriesResponse.data)
      ? categoriesResponse.data
      : [];

    // Extract tags from entries for filter
    const allTags = extractAllTags(entries);
    const formattedEntries = formatEntries(entries.slice(0, 6));

    res.render("homepage", {
      ...siteConfig,
      navItems: getNavWithActive("/"),
      entries: formattedEntries,
      allTags: allTags.slice(0, 10), // Only show top 10 tags
      categories,
      welcomeHeader: "Welcome to My Digital Diary",
      welcomeMessage:
        "This is my personal digital space where I share my thoughts, experiences, and memories.",
    });
  } catch (err) {
    console.error("Error on homepage:", err.message);
    res.render("homepage", {
      ...siteConfig,
      navItems: getNavWithActive("/"),
      entries: [],
      allTags: [],
      categories: [],
      error: "Error loading content",
    });
  }
});

// ====== ENTRY ROUTES (specific routes BEFORE :id route) ======

router.get("/entry/new", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to create entries");
  }

  try {
    // Get categories for dropdown
    const categoriesResponse = await axios
      .get(`${API_URL}/api/categories`)
      .catch(() => ({ data: [] }));
    const categories = categoriesResponse.data || [];

    res.render("entry-form", {
      ...siteConfig,
      title: "Create New Entry - Digital Diary",
      navItems: getNavWithActive(null),
      categories,
      isEdit: false,
      entry: null,
      errorMessage: req.query.error
        ? decodeURIComponent(req.query.error)
        : null,
      successMessage: req.query.message
        ? decodeURIComponent(req.query.message)
        : null,
    });
  } catch (err) {
    console.error("Error loading entry form:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message: "Error loading entry form",
      error: { status: 500 },
    });
  }
});
// Handle entry creation
router.post("/entry/new", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to create entries");
  }

  try {
    const { title, content, category, tags, date, isPublic } = req.body;

    const entryData = {
      title,
      content,
      date: date || new Date().toISOString().split("T")[0],
      isPublic: isPublic === "on" || isPublic === "true" || isPublic === true, // Converter checkbox
    };

    if (category) entryData.category = category;
    if (tags) {
      entryData.tags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);
    }

    console.log("Sending entry data:", entryData); // Debug log

    const response = await axios.post(`${API_URL}/api/entries`, entryData, {
      headers: {
        Authorization: `Bearer ${req.session.token}`,
        "Content-Type": "application/json",
      },
    });

    res.redirect(
      `/entry/${response.data._id}?message=Entry created successfully`
    );
  } catch (err) {
    console.error("Error creating entry:", err.response?.data || err.message);

    // Get categories again for re-rendering the form
    try {
      const categoriesResponse = await axios
        .get(`${API_URL}/api/categories`)
        .catch(() => ({ data: [] }));
      const categories = categoriesResponse.data || [];

      const errorMessage =
        err.response?.data?.message || "Error creating entry";

      res.render("entry-form", {
        ...siteConfig,
        title: "Create New Entry - Digital Diary",
        navItems: getNavWithActive(null),
        categories,
        isEdit: false,
        entry: req.body, // Return the form data to preserve user input
        errorMessage,
        successMessage: null,
      });
    } catch (renderErr) {
      console.error("Error re-rendering form:", renderErr.message);
      const errorMessage =
        err.response?.data?.message || "Error creating entry";
      res.redirect(`/entry/new?error=${encodeURIComponent(errorMessage)}`);
    }
  }
});
// Edit entry page - MUST BE BEFORE /entry/:id

router.post("/entry/:id/edit", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to edit entries");
  }

  try {
    const { title, content, category, tags, date } = req.body;

    const entryData = {
      title,
      content,
      date,
    };

    if (category) entryData.category = category;
    if (tags) {
      entryData.tags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);
    }

    await axios.put(`${API_URL}/api/entries/${req.params.id}`, entryData, {
      headers: {
        Authorization: `Bearer ${req.session.token}`,
        "Content-Type": "application/json",
      },
    });

    res.redirect(`/entry/${req.params.id}?message=Entry updated successfully`);
  } catch (err) {
    console.error("Error updating entry:", err.response?.data || err.message);

    // Re-render form with error message and preserve data
    try {
      const categoriesResponse = await axios
        .get(`${API_URL}/api/categories`)
        .catch(() => ({ data: [] }));
      const categories = categoriesResponse.data || [];

      const errorMessage =
        err.response?.data?.message || "Error updating entry";

      res.render("entry-form", {
        ...siteConfig,
        title: `Edit Entry - Digital Diary`,
        navItems: getNavWithActive(null),
        categories,
        isEdit: true,
        entry: { ...req.body, _id: req.params.id, id: req.params.id }, // Preserve form data
        errorMessage,
        successMessage: null,
      });
    } catch (renderErr) {
      console.error("Error re-rendering edit form:", renderErr.message);
      const errorMessage =
        err.response?.data?.message || "Error updating entry";
      res.redirect(
        `/entry/${req.params.id}/edit?error=${encodeURIComponent(errorMessage)}`
      );
    }
  }
});

// Delete entry
router.post("/entry/:id/delete", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to delete entries");
  }

  try {
    await axios.delete(`${API_URL}/api/entries/${req.params.id}`, {
      headers: { Authorization: `Bearer ${req.session.token}` },
    });

    res.redirect("/?message=Entry deleted successfully");
  } catch (err) {
    console.error("Error deleting entry:", err.response?.data || err.message);

    const errorMessage = err.response?.data?.message || "Error deleting entry";
    res.redirect(
      `/entry/${req.params.id}?error=${encodeURIComponent(errorMessage)}`
    );
  }
});

/// GET entry by ID - with proper authentication
router.get("/entry/:id", async (req, res) => {
  try {
    // Include authorization header if user is logged in
    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    const response = await axios.get(
      `${API_URL}/api/entries/${req.params.id}`,
      {
        headers,
      }
    );
    const entry = response.data;

    const formattedEntry = {
      ...entry,
      id: entry._id || entry.id,
      date: entry.date ? new Date(entry.date).toLocaleDateString() : "No date",
      tags: entry.tags || [],
      category: entry.category?.name || entry.category,
    };

    res.render("entry", {
      ...siteConfig,
      title: `${entry.title} - Digital Diary`,
      navItems: getNavWithActive(null),
      entry: formattedEntry,
      errorMessage: req.query.error
        ? decodeURIComponent(req.query.error)
        : null,
      successMessage: req.query.message
        ? decodeURIComponent(req.query.message)
        : null,
    });
  } catch (err) {
    console.error("Error fetching entry:", err.response?.data || err.message);

    if (err.response?.status === 404) {
      return res.status(404).render("entry", {
        ...siteConfig,
        navItems: getNavWithActive(null),
        entry: null,
        errorMessage: "Entry not found",
      });
    }

    if (err.response?.status === 403) {
      return res.status(403).render("entry", {
        ...siteConfig,
        navItems: getNavWithActive(null),
        entry: null,
        errorMessage: "You don't have permission to view this entry",
      });
    }

    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message: "Error loading entry",
      error: { status: 500 },
    });
  }
});

// ====== OTHER ROUTES ======

/* GET timeline page with tag filtering */
router.get("/timeline", async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, tag } = req.query;

    // Use entries endpoint instead of timeline/events
    const params = { page, limit };
    if (search) params.search = search;

    const entriesResponse = await axios.get(`${API_URL}/api/entries`, {
      params,
    });

    let entries = Array.isArray(entriesResponse.data)
      ? entriesResponse.data
      : entriesResponse.data.entries || [];

    // Format entries consistently
    entries = entries.map((entry) => ({
      ...entry,
      id: entry._id || entry.id,
      title: entry.title || "Untitled",
      content: entry.content || "",
      excerpt: entry.content
        ? entry.content.substring(0, 200) + "..."
        : "No content",
      date: entry.date ? new Date(entry.date).toLocaleDateString() : "No date",
      category: entry.category?.name || entry.category || "Uncategorized",
      tags: entry.tags || [],
    }));

    // Filter by category if specified
    if (category && category !== "all") {
      entries = entries.filter(
        (entry) =>
          entry.category?.toLowerCase().includes(category.toLowerCase()) ||
          (entry.category && entry.category === category)
      );
    }

    // Filter by tag if specified
    if (tag && tag !== "all") {
      entries = entries.filter(
        (entry) =>
          entry.tags &&
          entry.tags.some((entryTag) => {
            const tagName =
              typeof entryTag === "string"
                ? entryTag
                : entryTag.name || entryTag;
            return tagName.toLowerCase().replace(/\s+/g, "-") === tag;
          })
      );
    }

    // Sort by date (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get all entries for tag extraction
    const allEntriesResponse = await axios
      .get(`${API_URL}/api/entries`)
      .catch(() => ({ data: [] }));
    const allEntries = Array.isArray(allEntriesResponse.data)
      ? allEntriesResponse.data
      : allEntriesResponse.data.entries || [];

    const allTags = extractAllTags(allEntries);

    // Get categories for filter
    const categoriesResponse = await axios
      .get(`${API_URL}/api/categories`)
      .catch(() => ({ data: [] }));

    const categories = Array.isArray(categoriesResponse.data)
      ? categoriesResponse.data
      : [];

    res.render("timeline", {
      ...siteConfig,
      title: "Timeline - Digital Diary",
      navItems: getNavWithActive("/timeline"),
      entries,
      categories,
      allTags: allTags.slice(0, 15), // Top 15 tags for filter
      currentTag: tag || "all",
      currentCategory: category || "all",
      currentSearch: search || "",
      totalEntries: entries.length,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(entries.length / limit),
        total: entries.length,
        hasNext: entries.length > limit * page,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error("Error fetching timeline:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive("/timeline"),
      message: "Error loading timeline",
      error: { status: 500 },
    });
  }
});

// Tag filter route (redirects to timeline with tag filter)
router.get("/tag/:tagSlug", (req, res) => {
  const tagSlug = req.params.tagSlug;
  res.redirect(`/timeline?tag=${tagSlug}`);
});

// Categories route
router.get("/categories", async (req, res) => {
  try {
    const [categoriesResponse, entriesResponse] = await Promise.all([
      axios.get(`${API_URL}/api/categories`),
      axios.get(`${API_URL}/api/entries`).catch(() => ({ data: [] })),
    ]);

    const categories = Array.isArray(categoriesResponse.data)
      ? categoriesResponse.data
      : [];
    const entries = Array.isArray(entriesResponse.data)
      ? entriesResponse.data
      : entriesResponse.data.entries || [];

    // Extract tags for sidebar
    const allTags = extractAllTags(entries);

    res.render("categories", {
      ...siteConfig,
      title: "Categories - Digital Diary",
      navItems: getNavWithActive("/categories"),
      categories,
      allTags: allTags.slice(0, 20), // Top 20 tags
      totalItems: categories.reduce((sum, cat) => sum + (cat.count || 0), 0),
      activeCategories: categories.length,
    });
  } catch (err) {
    console.error("Error fetching categories:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive("/categories"),
      message: "Error loading categories",
      error: { status: 500 },
    });
  }
});

// About route
router.get("/about", (req, res) => {
  res.render("about", {
    ...siteConfig,
    title: "About - Digital Diary",
    navItems: getNavWithActive("/about"),
  });
});

// Simplified search route
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const tag = req.query.tag || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!query.trim() && !tag.trim()) {
      // Get all entries for tag extraction when no search
      const allEntriesResponse = await axios
        .get(`${API_URL}/api/entries`)
        .catch(() => ({ data: [] }));
      const allEntries = Array.isArray(allEntriesResponse.data)
        ? allEntriesResponse.data
        : allEntriesResponse.data.entries || [];
      const allTags = extractAllTags(allEntries);

      return res.render("search-results", {
        ...siteConfig,
        title: "Search - Digital Diary",
        navItems: getNavWithActive(null),
        query: "",
        currentTag: "",
        results: [],
        resultsCount: 0,
        allTags: allTags.slice(0, 15),
        noResultsMessage: "Please enter a search term or select a tag.",
      });
    }

    // Search entries using the entries endpoint
    const params = { page, limit };
    if (query.trim()) {
      // For now, we'll get all entries and filter client-side
      // until we implement proper search in the backend
      params.limit = 1000; // Get more entries for better search results
    }

    const response = await axios.get(`${API_URL}/api/entries`, { params });

    let results = Array.isArray(response.data)
      ? response.data
      : response.data.entries || [];

    // Client-side search if query is provided
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      results = results.filter(
        (entry) =>
          (entry.title && entry.title.toLowerCase().includes(searchTerm)) ||
          (entry.content && entry.content.toLowerCase().includes(searchTerm)) ||
          (entry.tags &&
            entry.tags.some((tag) => {
              const tagName = typeof tag === "string" ? tag : tag.name || tag;
              return tagName.toLowerCase().includes(searchTerm);
            }))
      );
    }

    // Filter by tag if specified
    if (tag && tag !== "all") {
      results = results.filter(
        (entry) =>
          entry.tags &&
          entry.tags.some((entryTag) => {
            const tagName =
              typeof entryTag === "string"
                ? entryTag
                : entryTag.name || entryTag;
            return tagName.toLowerCase().replace(/\s+/g, "-") === tag;
          })
      );
    }

    const formattedResults = formatEntries(results.slice(0, limit));

    // Get all tags for filter
    const allEntriesResponse = await axios
      .get(`${API_URL}/api/entries`)
      .catch(() => ({ data: [] }));
    const allEntries = Array.isArray(allEntriesResponse.data)
      ? allEntriesResponse.data
      : allEntriesResponse.data.entries || [];
    const allTags = extractAllTags(allEntries);

    res.render("search-results", {
      ...siteConfig,
      title: query
        ? `Search Results for "${query}" - Digital Diary`
        : "Search Results - Digital Diary",
      navItems: getNavWithActive(null),
      query,
      currentTag: tag,
      results: formattedResults,
      resultsCount: results.length,
      allTags: allTags.slice(0, 15),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(results.length / limit),
        total: results.length,
      },
      noResultsMessage: query
        ? `No results found for "${query}".`
        : `No entries found with tag "${tag}".`,
    });
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message: "Error performing search",
      error: { status: 500 },
    });
  }
});

// News/Public content routes
router.get("/news", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const response = await axios.get(`${API_URL}/api/news`, {
      params: { page, limit },
    });

    const news = response.data.news || [];

    res.render("news", {
      ...siteConfig,
      title: "News - Digital Diary",
      navItems: getNavWithActive("/news"),
      news,
      pagination: {
        currentPage: response.data.currentPage || 1,
        totalPages: response.data.totalPages || 1,
        total: response.data.total || 0,
      },
    });
  } catch (err) {
    console.error("Error fetching news:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive("/news"),
      message: "Error loading news",
      error: { status: 500 },
    });
  }
});

// Social sharing routes
router.get("/social/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${API_URL}/api/social/${req.params.id}/links`
    );
    res.json(response.data);
  } catch (err) {
    console.error("Error getting social links:", err.message);
    res.status(500).json({ error: "Error generating social links" });
  }
});

module.exports = router;
