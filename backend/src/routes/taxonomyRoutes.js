// backend/src/routes/taxonomyRoutes.js
const express = require("express");
const router = express.Router();
const taxonomyController = require("../controllers/taxonomyController");
const { protect, admin } = require("../middleware/auth");

/**
 * @swagger
 * /taxonomy:
 *   get:
 *     summary: Get taxonomy tree
 *     tags: [Taxonomy]
 *     responses:
 *       200:
 *         description: Hierarchical taxonomy structure
 */
router.get("/", taxonomyController.getAllTaxonomies);

/**
 * @swagger
 * /taxonomy:
 *   post:
 *     summary: Create new taxonomy entry (admin only)
 *     tags: [Taxonomy]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", protect, admin, taxonomyController.createTaxonomy);

module.exports = router;
