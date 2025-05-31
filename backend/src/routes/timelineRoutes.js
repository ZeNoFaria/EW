// backend/src/routes/timelineRoutes.js
const express = require("express");
const router = express.Router();
const timelineController = require("../controllers/timelineController");
const { protect } = require("../middleware/auth");

/**
 * @swagger
 * /timeline:
 *   get:
 *     summary: Get chronological timeline
 *     tags: [Timeline]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 */
router.get("/", timelineController.getTimelineEvents);

/**
 * @swagger
 * /timeline/stats:
 *   get:
 *     summary: Get timeline statistics
 *     tags: [Timeline]
 */
router.get("/stats", timelineController.getTimelineStats);

/**
 * @swagger
 * /timeline/search:
 *   get:
 *     summary: Search timeline
 *     tags: [Timeline]
 */
router.get("/search", timelineController.searchTimeline);

module.exports = router;
