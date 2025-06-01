const express = require("express");
const router = express.Router();
const axios = require("axios");

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// Site configuration
const siteConfig = {
  siteName: "My Digital Diary",
  title: "Digital Diary",
};

// Navigation helper
const getNavWithActive = (activeUrl, isPublicArea = false) => {
  const publicNavItems = [
    { text: "Home", url: "/", active: false },
    { text: "Public Timeline", url: "/public", active: false },
    { text: "Browse Archive", url: "/archive/public", active: false },
    { text: "Browse Content", url: "/browse", active: false },
  ];

  const privateNavItems = [
    { text: "Dashboard", url: "/dashboard", active: false },
    { text: "My Timeline", url: "/timeline", active: false },
    { text: "Categories", url: "/categories", active: false },
    { text: "Archive", url: "/archive", active: false },
    { text: "SIP Upload", url: "/archive/upload", active: false },
    { text: "Browse Content", url: "/browse", active: false },
  ];

  const navItems = isPublicArea ? publicNavItems : privateNavItems;
  return navItems.map((item) => ({
    ...item,
    active: item.url === activeUrl,
  }));
};

// Middleware to detect public vs private areas
router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.token;
  res.locals.session = req.session;

  // Determine if this is a public area
  res.locals.isPublicArea =
    !req.session.token || req.path.startsWith("/public");

  next();
});

// ATUALIZADO - Archive home page usando endpoints corretos
router.get("/", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/archive/public");
  }

  try {
    const headers = { Authorization: `Bearer ${req.session.token}` };

    const [aipsResponse, taxonomyResponse, statsResponse] = await Promise.all([
      axios
        .get(`${API_URL}/api/sip/aips`, {
          params: { limit: 6 },
          headers,
        })
        .catch(() => ({ data: { aips: [] } })),
      axios.get(`${API_URL}/api/taxonomy`).catch(() => ({ data: [] })),
      axios
        .get(`${API_URL}/api/admin/stats`, { headers })
        .catch(() => ({ data: {} })),
    ]);

    const recentAips = aipsResponse.data.aips || [];
    const taxonomies = taxonomyResponse.data || [];
    const stats = statsResponse.data || {};

    res.render("archive-home", {
      ...siteConfig,
      title: "Digital Archive - Digital Diary",
      navItems: getNavWithActive("/archive", false),
      recentAips,
      taxonomies,
      stats: {
        totalAips: stats.totalAips || recentAips.length,
        publicAips: stats.publicAips || 0,
        processingAips: stats.processingAips || 0,
        totalSize: stats.totalSize || "0 GB",
      },
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
      stats: {},
      errorMessage: "Error loading archive data",
      isPublicArea: false,
    });
  }
});

// ATUALIZADO - Public archive usando endpoint correto
router.get("/public", async (req, res) => {
  try {
    const {
      page = 1,
      tipo,
      search,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const [aipsResponse, categoriesResponse] = await Promise.all([
      axios.get(`${API_URL}/api/public/aips`, {
        params: { page, limit: 12, tipo, search, sortBy, order },
      }),
      axios.get(`${API_URL}/api/categories`).catch(() => ({ data: [] })),
    ]);

    const aips = aipsResponse.data.aips || [];
    const pagination = aipsResponse.data.pagination || {};
    const categories = categoriesResponse.data || [];

    res.render("archive-public", {
      ...siteConfig,
      title: "Public Archive - Digital Diary",
      navItems: getNavWithActive("/archive/public", true),
      aips,
      pagination,
      categories,
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
      pagination: {},
      categories: [],
      filters: req.query,
      error: "Error loading archive",
      isPublicArea: true,
    });
  }
});

// Upload SIP page (não mudou muito)
router.get("/upload", (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to upload content");
  }

  res.render("archive-upload", {
    ...siteConfig,
    title: "Upload SIP Package - Digital Diary",
    navItems: getNavWithActive("/archive/upload", false),
    isPublicArea: false,
  });
});

// ATUALIZADO - Browse AIPs usando endpoint correto
router.get("/aips", async (req, res) => {
  try {
    const {
      page = 1,
      tipo,
      search,
      sortBy = "createdAt",
      order = "desc",
      isPublic,
    } = req.query;

    const headers = {};
    let endpoint = `${API_URL}/api/public/aips`; // Default to public

    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
      endpoint = `${API_URL}/api/sip/aips`; // Use private endpoint if authenticated
    }

    const response = await axios.get(endpoint, {
      params: { page, limit: 12, tipo, search, sortBy, order, isPublic },
      headers,
    });

    const aips = response.data.aips || [];
    const pagination = response.data.pagination || {};

    res.render("archive-aips", {
      ...siteConfig,
      title: "Archive Information Packages - Digital Diary",
      navItems: getNavWithActive("/archive/aips", res.locals.isPublicArea),
      aips,
      pagination,
      filters: { page, tipo, search, sortBy, order, isPublic },
      isPublicArea: res.locals.isPublicArea,
    });
  } catch (err) {
    console.error("Error fetching AIPs:", err.message);
    res.render("archive-aips", {
      ...siteConfig,
      title: "Archive Information Packages - Digital Diary",
      navItems: getNavWithActive("/archive/aips", res.locals.isPublicArea),
      aips: [],
      pagination: {},
      filters: req.query,
      error: "Error loading AIPs",
      isPublicArea: res.locals.isPublicArea,
    });
  }
});

// ATUALIZADO - AIP detail page usando endpoints corretos
router.get("/aip/:id", async (req, res) => {
  try {
    const headers = {};
    let endpoint = `${API_URL}/api/public/aips/${req.params.id}`; // Default to public

    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
      endpoint = `${API_URL}/api/sip/aips/${req.params.id}`; // Use private endpoint if authenticated
    }

    const [aipResponse, commentsResponse] = await Promise.all([
      axios.get(endpoint, { headers }),
      axios
        .get(`${API_URL}/api/comments/aip/${req.params.id}`, {
          params: { page: 1, limit: 10 },
          headers,
        })
        .catch(() => ({ data: { comments: [] } })),
    ]);

    const aip = aipResponse.data.aip || aipResponse.data;
    const comments = commentsResponse.data.comments || [];

    const isOwner =
      req.session.user &&
      (aip.metadata?.produtor?._id === req.session.user.id ||
        aip.uploader === req.session.user.id);

    res.render("archive-aip-detail", {
      ...siteConfig,
      title: aip.metadata?.titulo || "AIP Details",
      navItems: getNavWithActive(null, res.locals.isPublicArea),
      aip,
      comments,
      isOwner,
      canDownload: isOwner || aip.metadata?.isPublic,
      isPublicArea: res.locals.isPublicArea,
    });
  } catch (err) {
    console.error("Error fetching AIP:", err.message);

    // If it's a 404, try the other endpoint
    if (err.response?.status === 404 && req.session.token) {
      try {
        const publicResponse = await axios.get(
          `${API_URL}/api/public/aips/${req.params.id}`
        );
        const aip = publicResponse.data.aip || publicResponse.data;

        return res.render("archive-aip-detail", {
          ...siteConfig,
          title: aip.metadata?.titulo || "AIP Details",
          navItems: getNavWithActive(null, true),
          aip,
          comments: [],
          isOwner: false,
          canDownload: aip.metadata?.isPublic,
          isPublicArea: true,
        });
      } catch (secondErr) {
        // Both failed, show error
      }
    }

    res.status(404).render("archive-aip-detail", {
      ...siteConfig,
      title: "AIP Not Found",
      navItems: getNavWithActive(null, res.locals.isPublicArea),
      aip: null,
      error: "AIP not found or access denied",
      isPublicArea: res.locals.isPublicArea,
    });
  }
});

// NOVO - My uploads (user's own AIPs)
router.get("/my-uploads", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to view your uploads");
  }

  try {
    const { page = 1, status, tipo, search } = req.query;

    // Get user's AIPs (need to filter by user on backend or use specific endpoint)
    const response = await axios.get(`${API_URL}/api/sip/aips`, {
      params: {
        page,
        limit: 10,
        uploader: req.session.user.id, // Assuming API supports this filter
        status,
        tipo,
        search,
      },
      headers: { Authorization: `Bearer ${req.session.token}` },
    });

    const myAips = response.data.aips || [];
    const pagination = response.data.pagination || {};

    res.render("archive-my-uploads", {
      ...siteConfig,
      title: "My Uploads - Digital Diary",
      navItems: getNavWithActive(null, false),
      myAips,
      pagination,
      filters: { status, tipo, search },
      isPublicArea: false,
    });
  } catch (err) {
    console.error("Error fetching my uploads:", err.message);
    res.render("archive-my-uploads", {
      ...siteConfig,
      title: "My Uploads - Digital Diary",
      navItems: getNavWithActive(null, false),
      myAips: [],
      pagination: {},
      filters: req.query,
      error: "Error loading your uploads",
      isPublicArea: false,
    });
  }
});

// ATUALIZADO - Download DIP usando endpoint correto
router.get("/download/:id", async (req, res) => {
  if (!req.session.token) {
    return res.redirect("/auth/login?error=Please login to download content");
  }

  try {
    // ENDPOINT CORRETO: /api/sip/dip/{id}/export
    const response = await axios.get(
      `${API_URL}/api/sip/dip/${req.params.id}/export`,
      {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
          Accept: "application/zip",
        },
        responseType: "stream",
        timeout: 120000, // 2 minutes timeout
      }
    );

    // Set headers for ZIP download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="aip-${req.params.id}-dip.zip"`
    );

    // Pipe the response stream to the client
    response.data.pipe(res);
  } catch (err) {
    console.error("Error downloading DIP:", err.response?.data || err.message);

    if (err.response?.status === 403) {
      return res.status(403).render("error", {
        ...siteConfig,
        navItems: getNavWithActive(null, false),
        message:
          "Access denied - you don't have permission to download this AIP",
        error: { status: 403 },
        isPublicArea: false,
      });
    }

    if (err.response?.status === 404) {
      return res.status(404).render("error", {
        ...siteConfig,
        navItems: getNavWithActive(null, false),
        message: "AIP not found",
        error: { status: 404 },
        isPublicArea: false,
      });
    }

    res.status(500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null, false),
      message: "Error downloading DIP package",
      error: { status: 500 },
      isPublicArea: false,
    });
  }
});
// NOVO - Serve individual file from AIP
router.get("/aip/:id/files/:fileId", async (req, res) => {
  try {
    const headers = {};
    let endpoint = `${API_URL}/api/public/aips/${req.params.id}/files/${req.params.fileId}`;

    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
      endpoint = `${API_URL}/api/sip/aips/${req.params.id}/files/${req.params.fileId}`;
    }

    const response = await axios.get(endpoint, {
      headers,
      responseType: "stream",
      timeout: 60000, // 1 minute timeout
    });

    // Forward the content type from the API
    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }

    if (response.headers["content-disposition"]) {
      res.setHeader(
        "Content-Disposition",
        response.headers["content-disposition"]
      );
    }

    response.data.pipe(res);
  } catch (err) {
    console.error("Error serving file:", err.response?.data || err.message);
    res.status(err.response?.status || 500).render("error", {
      ...siteConfig,
      navItems: getNavWithActive(null, res.locals.isPublicArea),
      message: "File not found or access denied",
      error: { status: err.response?.status || 500 },
      isPublicArea: res.locals.isPublicArea,
    });
  }
});

module.exports = router;
