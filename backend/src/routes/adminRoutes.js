const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
const { protect, admin } = require("../middleware/auth");
const { logAction } = require("../middleware/logger");

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Get general statistics (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: General statistics
 *       403:
 *         description: Admin access required
 */
router.get(
  "/stats",
  protect,
  admin,
  logAction("view"),
  statsController.getGeneralStats
);

/**
 * @swagger
 * /admin/stats/detailed:
 *   get:
 *     summary: Get detailed statistics (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Detailed statistics
 *       403:
 *         description: Admin access required
 */
router.get(
  "/stats/detailed",
  protect,
  admin,
  logAction("view"),
  statsController.getDetailedStats
);

/**
 * @swagger
 * /admin/stats/export:
 *   get:
 *     summary: Export statistics (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [general, logs, aips]
 *           default: general
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *     responses:
 *       200:
 *         description: Exported statistics
 *       403:
 *         description: Admin access required
 */
router.get(
  "/stats/export",
  protect,
  admin,
  logAction("export"),
  statsController.exportStats
);

module.exports = router;
