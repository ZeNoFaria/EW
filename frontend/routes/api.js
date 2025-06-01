const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// CORRETO - SIP ingest endpoint (API: POST /api/sip/ingest)
router.post(
  "/sip/ingest",
  requireAuth,
  upload.single("sipFile"),
  async (req, res) => {
    try {
      const FormData = require("form-data");
      const fs = require("fs");

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
          message: "SIP file is required",
        });
      }

      const formData = new FormData();
      formData.append(
        "sipFile",
        fs.createReadStream(req.file.path),
        req.file.originalname
      );

      // Add metadata fields from form
      Object.keys(req.body).forEach((key) => {
        if (req.body[key]) {
          formData.append(key, req.body[key]);
        }
      });

      console.log("Uploading SIP to:", `${API_URL}/api/sip/ingest`);
      console.log("Headers:", { Authorization: `Bearer ${req.session.token}` });

      const response = await axios.post(`${API_URL}/api/sip/ingest`, formData, {
        headers: {
          Authorization: `Bearer ${req.session.token}`,
          ...formData.getHeaders(),
        },
        timeout: 300000, // 5 minutes timeout for large files
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: "SIP uploaded and processed successfully",
        aipId: response.data.aipId || response.data.id,
        data: response.data,
      });
    } catch (error) {
      console.error("SIP ingest error:", error.response?.data || error.message);

      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          require("fs").unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }

      // Send detailed error response
      const errorMessage =
        error.response?.data?.message || error.message || "Upload failed";
      const statusCode = error.response?.status || 500;

      res.status(statusCode).json({
        success: false,
        error: "Ingest failed",
        message: errorMessage,
        details:
          process.env.NODE_ENV === "development"
            ? error.response?.data
            : undefined,
      });
    }
  }
);

// CORRETO - AIP visibility toggle (API: PUT /api/sip/aips/{id}/visibility)
router.post("/aip/:id/visibility", requireAuth, async (req, res) => {
  try {
    const response = await axios.put(
      `${API_URL}/api/sip/aips/${req.params.id}/visibility`,
      { isPublic: req.body.isPublic },
      {
        headers: { Authorization: `Bearer ${req.session.token}` },
      }
    );

    res.json({
      success: true,
      message: "Visibility updated successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Visibility update error:",
      error.response?.data || error.message
    );

    const errorMessage = error.response?.data?.message || "Update failed";
    const statusCode = error.response?.status || 500;

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: errorMessage,
    });
  }
});

// CORRETO - Comments endpoints (API: POST /api/comments/aip/{aipId})
router.post("/comments/aip/:aipId", requireAuth, async (req, res) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/comments/aip/${req.params.aipId}`,
      req.body,
      {
        headers: { Authorization: `Bearer ${req.session.token}` },
      }
    );

    res.json({
      success: true,
      message: "Comment created successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Comment creation error:",
      error.response?.data || error.message
    );

    const errorMessage =
      error.response?.data?.message || "Comment creation failed";
    const statusCode = error.response?.status || 500;

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
    });
  }
});

// CORRETO - Get comments (API: GET /api/comments/aip/{aipId})
router.get("/comments/aip/:aipId", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    const response = await axios.get(
      `${API_URL}/api/comments/aip/${req.params.aipId}`,
      {
        params: { page, limit },
        headers,
      }
    );

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Comments fetch error:",
      error.response?.data || error.message
    );

    const errorMessage =
      error.response?.data?.message || "Failed to fetch comments";
    const statusCode = error.response?.status || 500;

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
    });
  }
});

// CORRETO - Tags endpoints (API: GET /api/tags)
router.get("/tags", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/api/tags`);
    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Tags fetch error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tags",
    });
  }
});

// CORRETO - Create tag (API: POST /api/tags)
router.post("/tags", requireAuth, async (req, res) => {
  try {
    const response = await axios.post(`${API_URL}/api/tags`, req.body, {
      headers: { Authorization: `Bearer ${req.session.token}` },
    });

    res.json({
      success: true,
      message: "Tag created successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("Tag creation error:", error.response?.data || error.message);

    const errorMessage = error.response?.data?.message || "Tag creation failed";
    const statusCode = error.response?.status || 500;

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
    });
  }
});

// NOVO - Search AIPs (API: GET /api/search/aips)
router.get("/search/aips", async (req, res) => {
  try {
    const headers = {};
    if (req.session.token) {
      headers.Authorization = `Bearer ${req.session.token}`;
    }

    const response = await axios.get(`${API_URL}/api/search/aips`, {
      params: req.query,
      headers,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Search error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: "Search failed",
    });
  }
});

// NOVO - Social links (API: GET /api/social/{id}/links)
router.get("/social/:id/links", async (req, res) => {
  try {
    const response = await axios.get(
      `${API_URL}/api/social/${req.params.id}/links`
    );
    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Social links error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: "Failed to generate social links",
    });
  }
});

module.exports = router;
