// backend/src/routes/searchRoutes.js
const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const { protect } = require("../middleware/auth");
const { logAction } = require("../middleware/logger");

/**
 * @swagger
 * /search/aips:
 *   get:
 *     summary: Search AIPs
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 */
router.get("/aips", protect, logAction("search"), searchController.searchAIPs);

module.exports = router;
