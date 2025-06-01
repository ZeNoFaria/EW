var express = require("express");
var router = express.Router();
var axios = require("axios");

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// Site configuration
const siteConfig = {
  siteName: "My Digital Diary",
  title: "Digital Diary",
};

// Navigation items separados por público/privado
const getPublicNavItems = () => [
  { text: "Home", url: "/", active: false },
  { text: "Public Timeline", url: "/public", active: false },
  { text: "Browse Archive", url: "/archive/public", active: false },
  { text: "Browse Content", url: "/browse", active: false },
];

const getPrivateNavItems = () => [
  { text: "Dashboard", url: "/dashboard", active: false },
  { text: "My Timeline", url: "/timeline", active: false },
  { text: "Categories", url: "/categories", active: false },
  { text: "Archive", url: "/archive", active: false },
  { text: "SIP Upload", url: "/archive/upload", active: false },
  { text: "Browse Content", url: "/browse", active: false },
];

// Helper function to set active navigation item
const getNavWithActive = (activeUrl, isPublicArea = false) => {
  const navItems = isPublicArea ? getPublicNavItems() : getPrivateNavItems();
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

// ALTERAR - Middleware para determinar área pública/privada
router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.token;

  // Determinar se é área pública ou privada
  res.locals.isPublicArea =
    !req.session.token ||
    req.path.startsWith("/public") ||
    req.path.startsWith("/archive/public") ||
    req.path === "/";

  next();
});

// ALTERAR COMPLETAMENTE - Homepage público vs Dashboard privado
// ATUALIZADO - Homepage público vs Dashboard privado
router.get("/", async function (req, res, next) {
  try {
    if (req.session.token) {
      return res.redirect("/dashboard");
    }

    // USAR ENDPOINTS CORRETOS DA API
    const [publicAipsResponse, publicStatsResponse] = await Promise.all([
      axios
        .get(`${API_URL}/api/public/aips`, {
          params: { limit: 6 },
        })
        .catch(() => ({ data: { aips: [] } })),
      axios.get(`${API_URL}/api/public/stats`).catch(() => ({ data: {} })),
    ]);

    const publicAips = publicAipsResponse.data.aips || [];
    const stats = publicStatsResponse.data || {};

    res.render("public-homepage", {
      ...siteConfig,
      title: "Digital Diary - Public Archive",
      navItems: getNavWithActive("/", true),
      entries: publicAips.slice(0, 6), // Usando AIPs públicos como "entries"
      stats,
      isPublicArea: true,
    });
  } catch (err) {
    console.error("Error on homepage:", err.message);
    res.render("public- ", {
      ...siteConfig,
      title: "Digital Diary - Public Archive",
      navItems: getNavWithActive("/", true),
      entries: [],
      stats: {},
      error: "Error loading content",
      isPublicArea: true,
    });
  }
});

/// ATUALIZADO - Dashboard privado usando stats corretos
router.get("/dashboard", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to access dashboard");
  }

  try {
    const headers = { Authorization: `Bearer ${req.session.token}` };

    const [entriesResponse, aipsResponse, statsResponse] = await Promise.all([
      axios
        .get(`${API_URL}/api/entries`, { headers })
        .catch(() => ({ data: { entries: [] } })),
      axios
        .get(`${API_URL}/api/sip/aips`, {
          params: { limit: 5 },
          headers,
        })
        .catch(() => ({ data: { aips: [] } })),
      axios
        .get(`${API_URL}/api/admin/stats`, { headers })
        .catch(() => ({ data: {} })),
    ]);

    const entries = entriesResponse.data.entries || [];
    const aips = aipsResponse.data.aips || [];
    const stats = statsResponse.data || {};

    res.render("private-dashboard", {
      ...siteConfig,
      title: "Dashboard - Digital Diary",
      navItems: getNavWithActive("/dashboard", false),
      recentEntries: formatEntries(entries.slice(0, 5)),
      recentAips: aips,
      stats: {
        totalEntries: stats.totalEntries || entries.length,
        publicEntries: stats.publicEntries || 0,
        totalAips: stats.totalAips || aips.length,
        totalViews: stats.totalViews || 0,
      },
      user: req.session.user,
      isPublicArea: false,
    });
  } catch (err) {
    console.error("Error loading dashboard:", err.message);
    res.render("private-dashboard", {
      ...siteConfig,
      title: "Dashboard - Digital Diary",
      navItems: getNavWithActive("/dashboard", false),
      recentEntries: [],
      recentAips: [],
      stats: {},
      error: "Error loading dashboard",
      isPublicArea: false,
    });
  }
});
// NOVA ROTA - Página pública de timeline
router.get("/public", async (req, res) => {
  try {
    const { page = 1, category, search } = req.query;

    const response = await axios.get(`${API_URL}/api/entries`, {
      params: { page, limit: 12 },
    });

    let entries = Array.isArray(response.data)
      ? response.data
      : response.data.entries || [];

    // Filtrar apenas públicas
    entries = entries.filter((entry) => entry.isPublic === true);

    // Aplicar filtros
    if (category && category !== "all") {
      entries = entries.filter(
        (entry) =>
          entry.category?.name?.toLowerCase() === category.toLowerCase()
      );
    }

    if (search) {
      const searchTerm = search.toLowerCase();
      entries = entries.filter(
        (entry) =>
          entry.title?.toLowerCase().includes(searchTerm) ||
          entry.content?.toLowerCase().includes(searchTerm)
      );
    }

    const categoriesResponse = await axios
      .get(`${API_URL}/api/categories`)
      .catch(() => ({ data: [] }));

    res.render("public-timeline", {
      ...siteConfig,
      title: "Public Timeline - Digital Diary",
      navItems: getNavWithActive("/public", true),
      entries: formatEntries(entries),
      categories: categoriesResponse.data || [],
      filters: { category, search },
      isPublicArea: true,
    });
  } catch (err) {
    console.error("Error loading public timeline:", err.message);
    res.render("public-timeline", {
      ...siteConfig,
      title: "Public Timeline - Digital Diary",
      navItems: getNavWithActive("/public", true),
      entries: [],
      categories: [],
      error: "Error loading timeline",
      isPublicArea: true,
    });
  }
});

// NOVA ROTA - Navegação semântica por classificadores
router.get("/browse", async (req, res) => {
  try {
    const { type, category, location, event } = req.query;

    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    const [taxonomiesResponse, entriesResponse] = await Promise.all([
      axios.get(`${API_URL}/api/taxonomy`).catch(() => ({ data: [] })),
      axios
        .get(`${API_URL}/api/entries`, { headers })
        .catch(() => ({ data: [] })),
    ]);

    let entries = Array.isArray(entriesResponse.data)
      ? entriesResponse.data
      : entriesResponse.data.entries || [];

    // Se não autenticado, apenas públicas
    if (!req.session.token) {
      entries = entries.filter((entry) => entry.isPublic === true);
    }

    // Organizar por tipo de conteúdo
    const contentTypes = {
      academic: {
        name: "Academic",
        icon: "fas fa-graduation-cap",
        entries: [],
      },
      sports: { name: "Sports & Fitness", icon: "fas fa-running", entries: [] },
      travel: {
        name: "Travel & Places",
        icon: "fas fa-map-marker-alt",
        entries: [],
      },
      personal: {
        name: "Personal Thoughts",
        icon: "fas fa-heart",
        entries: [],
      },
      professional: {
        name: "Professional",
        icon: "fas fa-briefcase",
        entries: [],
      },
    };

    // Categorizar entradas por tipo
    entries.forEach((entry) => {
      const entryType = entry.category?.slug || "personal";
      if (contentTypes[entryType]) {
        contentTypes[entryType].entries.push(entry);
      } else {
        contentTypes.personal.entries.push(entry);
      }
    });

    res.render("semantic-browse", {
      ...siteConfig,
      title: "Browse by Category - Digital Diary",
      navItems: getNavWithActive("/browse", res.locals.isPublicArea),
      contentTypes,
      taxonomies: taxonomiesResponse.data,
      filters: { type, category, location, event },
      isPublicArea: res.locals.isPublicArea,
    });
  } catch (err) {
    console.error("Error in semantic browse:", err.message);
    res.render("semantic-browse", {
      ...siteConfig,
      title: "Browse by Category - Digital Diary",
      navItems: getNavWithActive("/browse", res.locals.isPublicArea),
      contentTypes: {},
      error: "Error loading content",
      isPublicArea: res.locals.isPublicArea,
    });
  }
});

// ============ ARCHIVE (SIP/AIP/DIP) ROUTES ============

// ATUALIZADO - Archive público usando endpoint correto
router.get("/archive/public", async (req, res) => {
  try {
    const {
      page = 1,
      tipo,
      search,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const response = await axios.get(`${API_URL}/api/public/aips`, {
      params: { page, limit: 12, tipo, search, sortBy, order },
    });

    res.render("archive-public", {
      ...siteConfig,
      title: "Public Archive - Digital Diary",
      navItems: getNavWithActive("/archive/public", true),
      aips: response.data.aips || [],
      pagination: response.data.pagination || {},
      filters: { tipo, search, sortBy, order },
      isPublicArea: true,
    });
  } catch (err) {
    console.error("Error loading public archive:", err.message);
    res.render("archive-public", {
      ...siteConfig,
      title: "Public Archive - Digital Diary",
      navItems: getNavWithActive("/archive/public", true),
      aips: [],
      error: "Error loading archive",
      isPublicArea: true,
    });
  }
});

// Archive principal (requer autenticação)
router.get("/archive", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/archive/public");
  }

  try {
    const headers = { Authorization: `Bearer ${req.session.token}` };

    const [aipsResponse, taxonomiesResponse] = await Promise.all([
      axios
        .get(`${API_URL}/api/sip/aips?limit=6`, { headers })
        .catch(() => ({ data: { aips: [] } })),
      axios.get(`${API_URL}/api/taxonomy`).catch(() => ({ data: [] })),
    ]);

    res.render("archive-home", {
      ...siteConfig,
      title: "Digital Archive - Digital Diary",
      navItems: getNavWithActive("/archive", false),
      recentAips: aipsResponse.data.aips || [],
      taxonomies: taxonomiesResponse.data || [],
      isPublicArea: false,
    });
  } catch (err) {
    console.error("Error loading archive:", err.message);
    res.render("archive-home", {
      ...siteConfig,
      title: "Digital Archive - Digital Diary",
      navItems: getNavWithActive("/archive", false),
      recentAips: [],
      taxonomies: [],
      errorMessage: "Error loading archive data",
      isPublicArea: false,
    });
  }
});

// Upload SIP
router.get("/archive/upload", (req, res) => {
  if (!req.session.token) {
    return res.redirect(
      "/auth/login?error=Please login to upload SIPs&returnUrl=/archive/upload"
    );
  }

  res.render("archive-upload", {
    ...siteConfig,
    title: "Upload SIP Package - Digital Archive",
    navItems: getNavWithActive("/archive/upload", false),
    isPublicArea: false,
  });
});

// Listar AIPs
router.get("/archive/aips", async (req, res) => {
  try {
    const { page = 1, tipo, search, status } = req.query;
    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    const params = new URLSearchParams({ page, limit: 12 });
    if (tipo) params.append("tipo", tipo);
    if (search) params.append("search", search);
    if (status) params.append("status", status);

    // Se não autenticado, apenas públicos
    if (!req.session.token) {
      params.append("isPublic", "true");
    }

    const [aipsResponse, taxonomiesResponse] = await Promise.all([
      axios.get(`${API_URL}/api/sip/aips?${params}`, { headers }),
      axios.get(`${API_URL}/api/taxonomy`).catch(() => ({ data: [] })),
    ]);

    res.render("archive-aips", {
      ...siteConfig,
      title: "Browse AIPs - Digital Archive",
      navItems: getNavWithActive("/archive/aips", res.locals.isPublicArea),
      aips: aipsResponse.data.aips || [],
      pagination: aipsResponse.data,
      taxonomies: taxonomiesResponse.data || [],
      filters: { tipo, search, status },
      isPublicArea: res.locals.isPublicArea,
    });
  } catch (err) {
    console.error("Error fetching AIPs:", err.message);
    res.render("archive-aips", {
      ...siteConfig,
      title: "Browse AIPs - Digital Archive",
      navItems: getNavWithActive("/archive/aips", res.locals.isPublicArea),
      aips: [],
      taxonomies: [],
      errorMessage: "Error loading AIPs",
      isPublicArea: res.locals.isPublicArea,
    });
  }
});

// Ver AIP individual
router.get("/archive/aip/:id", async (req, res) => {
  try {
    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    const response = await axios.get(
      `${API_URL}/api/sip/aips/${req.params.id}`,
      { headers }
    );

    res.render("archive-aip-detail", {
      ...siteConfig,
      title: `${response.data.metadata.titulo} - Digital Archive`,
      navItems: getNavWithActive("/archive", res.locals.isPublicArea),
      aip: response.data,
      isPublicArea: res.locals.isPublicArea,
      isOwner:
        req.session.user &&
        req.session.user.id === response.data.metadata.produtor._id,
    });
  } catch (err) {
    console.error("Error fetching AIP:", err.message);
    if (err.response?.status === 404) {
      return res.status(404).render("error", {
        ...siteConfig,
        title: "AIP Not Found",
        navItems: getNavWithActive("/archive", res.locals.isPublicArea),
        errorMessage: "The requested AIP was not found",
        statusCode: 404,
      });
    }
    if (err.response?.status === 403) {
      return res.status(403).render("error", {
        ...siteConfig,
        title: "Access Denied",
        navItems: getNavWithActive("/archive", res.locals.isPublicArea),
        errorMessage: "You don't have permission to view this AIP",
        statusCode: 403,
      });
    }
    res.redirect("/archive/aips?error=Error loading AIP");
  }
});

// My uploads (AIPs do utilizador)
router.get("/archive/my-uploads", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to view your uploads");
  }

  try {
    const { page = 1, status } = req.query;
    const headers = { Authorization: `Bearer ${req.session.token}` };

    const params = new URLSearchParams({
      page,
      limit: 10,
      produtor: "me",
    });
    if (status) params.append("status", status);

    const response = await axios.get(`${API_URL}/api/sip/aips?${params}`, {
      headers,
    });

    res.render("archive-my-uploads", {
      ...siteConfig,
      title: "My Uploads - Digital Archive",
      navItems: getNavWithActive("/archive", false),
      aips: response.data.aips || [],
      pagination: response.data,
      filters: { status },
      isPublicArea: false,
    });
  } catch (err) {
    console.error("Error fetching user AIPs:", err.message);
    res.render("archive-my-uploads", {
      ...siteConfig,
      title: "My Uploads - Digital Archive",
      navItems: getNavWithActive("/archive", false),
      aips: [],
      errorMessage: "Error loading your uploads",
      isPublicArea: false,
    });
  }
});

// Download DIP
router.get("/archive/download/:id", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to download DIPs");
  }

  try {
    const headers = { Authorization: `Bearer ${req.session.token}` };

    // Proxy the download request
    const response = await axios.get(
      `${API_URL}/api/dip/export/${req.params.id}`,
      {
        headers,
        responseType: "stream",
      }
    );

    // Set appropriate headers
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="DIP-${req.params.id}.zip"`
    );

    // Pipe the response
    response.data.pipe(res);
  } catch (err) {
    console.error("Error downloading DIP:", err.message);
    res.redirect(`/archive/aip/${req.params.id}?error=Error downloading DIP`);
  }
});

// ====== VISIBILITY CONTROL ======

// Toggle visibilidade de entrada
router.post("/entry/:id/visibility", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to change visibility");
  }

  try {
    const { isPublic } = req.body;

    await axios.put(
      `${API_URL}/api/entries/${req.params.id}/visibility`,
      { isPublic: isPublic === "true" || isPublic === "on" },
      { headers: { Authorization: `Bearer ${req.session.token}` } }
    );

    res.redirect(
      `/entry/${req.params.id}?message=Visibility updated successfully`
    );
  } catch (err) {
    console.error("Error updating visibility:", err.message);
    res.redirect(`/entry/${req.params.id}?error=Error updating visibility`);
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
      navItems: getNavWithActive(null, false),
      categories,
      isEdit: false,
      entry: null,
      errorMessage: req.query.error
        ? decodeURIComponent(req.query.error)
        : null,
      successMessage: req.query.message
        ? decodeURIComponent(req.query.message)
        : null,
      isPublicArea: false,
    });
  } catch (err) {
    console.error("Error loading entry form:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null, false),
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
      isPublic: isPublic === "on" || isPublic === "true" || isPublic === true,
    };

    if (category) entryData.category = category;
    if (tags) {
      entryData.tags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);
    }

    console.log("Sending entry data:", entryData);

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
        navItems: getNavWithActive(null, false),
        categories,
        isEdit: false,
        entry: req.body,
        errorMessage,
        successMessage: null,
        isPublicArea: false,
      });
    } catch (renderErr) {
      console.error("Error re-rendering form:", renderErr.message);
      const errorMessage =
        err.response?.data?.message || "Error creating entry";
      res.redirect(`/entry/new?error=${encodeURIComponent(errorMessage)}`);
    }
  }
});

// ADICIONAR - GET route para edit entry (ANTES da rota /entry/:id)
router.get("/entry/:id/edit", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to edit entries");
  }

  try {
    const headers = { Authorization: `Bearer ${req.session.token}` };

    // Buscar a entrada e as categorias
    const [entryResponse, categoriesResponse] = await Promise.all([
      axios.get(`${API_URL}/api/entries/${req.params.id}`, { headers }),
      axios.get(`${API_URL}/api/categories`).catch(() => ({ data: [] })),
    ]);

    const entry = entryResponse.data;
    const categories = categoriesResponse.data || [];

    // Verificar se o utilizador pode editar esta entrada
    const isOwner =
      req.session.user &&
      (req.session.user.id === entry.author?._id ||
        req.session.user.id === entry.createdBy?._id ||
        req.session.user.id === entry.userId);

    const isAdmin = req.session.user?.isAdmin;

    if (!isOwner && !isAdmin) {
      return res.status(403).render("error", {
        ...siteConfig,
        title: "Access Denied",
        navItems: getNavWithActive(null, false),
        errorMessage: "You don't have permission to edit this entry",
        statusCode: 403,
        isPublicArea: false,
      });
    }

    // Formatar entrada para o formulário
    const formattedEntry = {
      ...entry,
      id: entry._id || entry.id,
      date: entry.date
        ? new Date(entry.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      tags: Array.isArray(entry.tags)
        ? entry.tags
            .map((tag) => (typeof tag === "string" ? tag : tag.name))
            .join(", ")
        : "",
      category: entry.category?._id || entry.category || "",
    };

    res.render("entry-form", {
      ...siteConfig,
      title: `Edit "${entry.title}" - Digital Diary`,
      navItems: getNavWithActive(null, false),
      categories,
      isEdit: true,
      entry: formattedEntry,
      errorMessage: req.query.error
        ? decodeURIComponent(req.query.error)
        : null,
      successMessage: req.query.message
        ? decodeURIComponent(req.query.message)
        : null,
      isPublicArea: false,
    });
  } catch (err) {
    console.error(
      "Error loading entry for edit:",
      err.response?.data || err.message
    );

    if (err.response?.status === 404) {
      return res.status(404).render("error", {
        ...siteConfig,
        title: "Entry Not Found",
        navItems: getNavWithActive(null, false),
        errorMessage: "The entry you're trying to edit was not found",
        statusCode: 404,
        isPublicArea: false,
      });
    }

    if (err.response?.status === 403) {
      return res.status(403).render("error", {
        ...siteConfig,
        title: "Access Denied",
        navItems: getNavWithActive(null, false),
        errorMessage: "You don't have permission to edit this entry",
        statusCode: 403,
        isPublicArea: false,
      });
    }

    const errorMessage =
      err.response?.data?.message || "Error loading entry for editing";
    res.redirect(
      `/entry/${req.params.id}?error=${encodeURIComponent(errorMessage)}`
    );
  }
});

// Edit entry page - MUST BE BEFORE /entry/:id
router.post("/entry/:id/edit", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to edit entries");
  }

  try {
    const { title, content, category, tags, date, isPublic } = req.body;

    const entryData = {
      title,
      content,
      date,
      isPublic: isPublic === "on" || isPublic === "true" || isPublic === true,
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
        navItems: getNavWithActive(null, false),
        categories,
        isEdit: true,
        entry: { ...req.body, _id: req.params.id, id: req.params.id },
        errorMessage,
        successMessage: null,
        isPublicArea: false,
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

    res.redirect("/dashboard?message=Entry deleted successfully");
  } catch (err) {
    console.error("Error deleting entry:", err.response?.data || err.message);

    const errorMessage = err.response?.data?.message || "Error deleting entry";
    res.redirect(
      `/entry/${req.params.id}?error=${encodeURIComponent(errorMessage)}`
    );
  }
});

// GET entry by ID - with proper authentication
router.get("/entry/:id", async (req, res) => {
  try {
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
      navItems: getNavWithActive(null, res.locals.isPublicArea),
      entry: formattedEntry,
      errorMessage: req.query.error
        ? decodeURIComponent(req.query.error)
        : null,
      successMessage: req.query.message
        ? decodeURIComponent(req.query.message)
        : null,
      isPublicArea: res.locals.isPublicArea,
    });
  } catch (err) {
    console.error("Error fetching entry:", err.response?.data || err.message);

    if (err.response?.status === 404) {
      return res.status(404).render("entry", {
        ...siteConfig,
        navItems: getNavWithActive(null, res.locals.isPublicArea),
        entry: null,
        errorMessage: "Entry not found",
        isPublicArea: res.locals.isPublicArea,
      });
    }

    if (err.response?.status === 403) {
      return res.status(403).render("entry", {
        ...siteConfig,
        navItems: getNavWithActive(null, res.locals.isPublicArea),
        entry: null,
        errorMessage: "You don't have permission to view this entry",
        isPublicArea: res.locals.isPublicArea,
      });
    }

    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null, res.locals.isPublicArea),
      message: "Error loading entry",
      error: { status: 500 },
    });
  }
});

// ====== OTHER ROUTES ======

router.get("/timeline", async (req, res) => {
  // VERIFICAR SE ESTÁ LOGADO
  if (!req.session.token) {
    return res.redirect("/public");
  }

  try {
    const { search, category, tag, page = 1, limit = 20 } = req.query;
    const headers = { Authorization: `Bearer ${req.session.token}` };

    const params = { page, limit };
    if (search) params.search = search;
    if (category && category !== "all") params.tipo = category;
    if (tag && tag !== "all") params.tag = tag;

    // Buscar dados em paralelo com fallbacks
    const [aipsResponse, categoriesResponse, tagsResponse] = await Promise.all([
      axios.get(`${API_URL}/api/sip/aips`, { headers, params }).catch((err) => {
        console.log("AIPs fetch error:", err.response?.data || err.message);
        return { data: { aips: [], total: 0 } };
      }),

      axios.get(`${API_URL}/api/categories`).catch((err) => {
        console.log(
          "Categories fetch error:",
          err.response?.data || err.message
        );
        return { data: [] };
      }),

      axios.get(`${API_URL}/api/tags`).catch((err) => {
        console.log("Tags fetch error:", err.response?.data || err.message);
        return { data: [] };
      }),
    ]);

    // Garantir que os dados são arrays
    const aips = Array.isArray(aipsResponse.data.aips)
      ? aipsResponse.data.aips
      : Array.isArray(aipsResponse.data)
      ? aipsResponse.data
      : [];
    const categories = Array.isArray(categoriesResponse.data)
      ? categoriesResponse.data
      : [];
    const allTags = Array.isArray(tagsResponse.data) ? tagsResponse.data : [];
    const totalEntries = aipsResponse.data.total || aips.length;

    // Converter AIPs para formato timeline
    const timelineEntries = aips.map((aip) => {
      const metadata = aip.metadata || {};

      return {
        ...aip,
        id: aip._id,
        title: metadata.titulo || "Untitled",
        titulo: metadata.titulo || "Untitled",
        descricao: metadata.descricao || "No description",
        date: metadata.dataCreacao || aip.createdAt,
        dataCreacao: metadata.dataCreacao || aip.createdAt,
        excerpt: metadata.descricao
          ? metadata.descricao.substring(0, 150) +
            (metadata.descricao.length > 150 ? "..." : "")
          : "No description",
        category: metadata.tipo,
        tipo: metadata.tipo,
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        isPublic: aip.isPublic || false,
        canEdit: true,
      };
    });

    // Calcular estatísticas das categorias
    const categoriesWithCounts = categories.map((cat) => ({
      ...cat,
      count: timelineEntries.filter((entry) => {
        const entryTipo = entry.metadata?.tipo || entry.tipo;
        return (
          (entryTipo && entryTipo._id === cat._id) || entryTipo === cat._id
        );
      }).length,
    }));

    // Calcular estatísticas das tags
    const tagsWithCounts = allTags.map((tag) => ({
      ...tag,
      slug: tag.name ? tag.name.replace(/\s+/g, "-").toLowerCase() : tag._id,
      count: timelineEntries.filter((entry) => {
        const entryTags = entry.metadata?.tags || entry.tags || [];
        return entryTags.some(
          (t) =>
            (typeof t === "object" && t._id === tag._id) ||
            (typeof t === "string" && t === tag._id)
        );
      }).length,
    }));

    res.render("timeline", {
      ...siteConfig,
      title: "My Timeline - Digital Diary",
      // CORRIGIDO - Navegação privada correta
      navItems: getNavWithActive("timeline", true), // true = logado, "timeline" = página ativa
      entries: timelineEntries,
      categories: categoriesWithCounts,
      allTags: tagsWithCounts,
      totalEntries,
      currentSearch: search || "",
      currentCategory: category || "all",
      currentTag: tag || "all",
      isAuthenticated: true,
      user: req.session.user,
      isPublicArea: false, // IMPORTANTE: não é área pública
    });
  } catch (err) {
    console.error("Timeline error:", err.response?.data || err.message);

    // Render com dados vazios seguros
    res.render("timeline", {
      ...siteConfig,
      title: "My Timeline - Digital Diary",
      // CORRIGIDO - Navegação privada mesmo em erro
      navItems: getNavWithActive("timeline", true),
      entries: [],
      categories: [],
      allTags: [],
      totalEntries: 0,
      currentSearch: req.query.search || "",
      currentCategory: req.query.category || "all",
      currentTag: req.query.tag || "all",
      error: "Error loading timeline data",
      isAuthenticated: true,
      user: req.session.user,
      isPublicArea: false,
    });
  }
});

// Tag filter route (redirects to timeline with tag filter)
router.get("/tag/:tagSlug", (req, res) => {
  const tagSlug = req.params.tagSlug;
  const redirectPath = req.session.token ? "/timeline" : "/public";
  res.redirect(`${redirectPath}?tag=${tagSlug}`);
});

// Categories route
router.get("/categories", async (req, res) => {
  try {
    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    const [categoriesResponse, entriesResponse] = await Promise.all([
      axios.get(`${API_URL}/api/categories`),
      axios
        .get(`${API_URL}/api/entries`, { headers })
        .catch(() => ({ data: [] })),
    ]);

    const categories = Array.isArray(categoriesResponse.data)
      ? categoriesResponse.data
      : [];

    let entries = Array.isArray(entriesResponse.data)
      ? entriesResponse.data
      : entriesResponse.data.entries || [];

    // Se não autenticado, filtrar apenas públicas
    if (!req.session.token) {
      entries = entries.filter((entry) => entry.isPublic === true);
    }

    const allTags = extractAllTags(entries);

    res.render("categories", {
      ...siteConfig,
      title: "Categories - Digital Diary",
      navItems: getNavWithActive("/categories", res.locals.isPublicArea),
      categories,
      allTags: allTags.slice(0, 20),
      totalItems: categories.reduce((sum, cat) => sum + (cat.count || 0), 0),
      activeCategories: categories.length,
      isPublicArea: res.locals.isPublicArea,
    });
  } catch (err) {
    console.error("Error fetching categories:", err.message);
    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive("/categories", res.locals.isPublicArea),
      message: "Error loading categories",
      error: { status: 500 },
    });
  }
});

// Simplified search route
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q || "";
    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    let results = [];

    if (query.trim()) {
      // USAR ENDPOINT CORRETO: /api/search/aips se autenticado, senão /api/public/aips
      let searchResponse;

      if (req.session.token) {
        // Authenticated search
        searchResponse = await axios
          .get(`${API_URL}/api/search/aips`, {
            params: { search: query },
            headers,
          })
          .catch(() => ({ data: { aips: [] } }));
      } else {
        // Public search
        searchResponse = await axios
          .get(`${API_URL}/api/public/aips`, {
            params: { search: query, limit: 20 },
          })
          .catch(() => ({ data: { aips: [] } }));
      }

      results = searchResponse.data.aips || searchResponse.data || [];
    }

    res.render("search-results", {
      ...siteConfig,
      title: query ? `Search Results for "${query}"` : "Search",
      navItems: getNavWithActive(null, res.locals.isPublicArea),
      query,
      results: formatEntries(results),
      resultsCount: results.length,
      isPublicArea: res.locals.isPublicArea,
    });
  } catch (err) {
    console.error("Search error:", err.response?.data || err.message);
    res.render("search-results", {
      ...siteConfig,
      title: "Search Error",
      navItems: getNavWithActive(null, res.locals.isPublicArea),
      query: req.query.q || "",
      results: [],
      error: "Error performing search",
      isPublicArea: res.locals.isPublicArea,
    });
  }
});

// Social sharing routes
router.get("/social/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${API_URL}/api/social/${req.params.id}/links`
    );
    res.json({
      success: true,
      data: response.data,
    });
  } catch (err) {
    console.error(
      "Error getting social links:",
      err.response?.data || err.message
    );
    res.status(500).json({
      success: false,
      error: "Error generating social links",
    });
  }
});

module.exports = router;
