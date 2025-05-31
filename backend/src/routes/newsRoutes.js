// backend/src/routes/newsRoutes.js
const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");
const { protect, admin } = require("../middleware/auth");

/**
 * @swagger
 * /news:
 *   get:
 *     summary: Get all news
 *     tags: [News]
 */
router.get("/", newsController.getAllNews);

/**
 * @swagger
 * /news:
 *   post:
 *     summary: Create news (admin only)
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", protect, admin, newsController.createNews);

/**
 * @swagger
 * /news/{id}:
 *   put:
 *     summary: Update news
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id", protect, newsController.updateNews);

/**
 * @swagger
 * /news/{id}:
 *   delete:
 *     summary: Delete news
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:id", protect, newsController.deleteNews);

module.exports = router;
