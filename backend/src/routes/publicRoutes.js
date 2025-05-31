const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");
const { logAction } = require("../middleware/logger");

/**
 * @swagger
 * /public/aips:
 *   get:
 *     summary: Get public AIPs (no authentication required)
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, title, date]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of public AIPs
 */
router.get("/aips", logAction("view"), publicController.getPublicAIPs);

/**
 * @swagger
 * /public/aips/{id}:
 *   get:
 *     summary: Get public AIP by ID
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public AIP details with comments
 *       404:
 *         description: AIP not found or not public
 */
router.get("/aips/:id", logAction("view"), publicController.getPublicAIPById);

/**
 * @swagger
 * /public/aips/{id}/files/{fileId}:
 *   get:
 *     summary: Get public file from AIP
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File content
 *       404:
 *         description: File not found or not public
 */
router.get(
  "/aips/:id/files/:fileId",
  logAction("download"),
  publicController.getPublicFile
);

/**
 * @swagger
 * /public/news:
 *   get:
 *     summary: Get visible news
 *     tags: [Public]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: List of visible news
 */
router.get("/news", publicController.getNews);

/**
 * @swagger
 * /public/stats:
 *   get:
 *     summary: Get public statistics
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Public statistics
 */
router.get("/stats", publicController.getPublicStats);

module.exports = router;
