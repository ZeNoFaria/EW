const express = require("express");
const router = express.Router();
const sipController = require("../controllers/sipController");
const dipController = require("../controllers/dipController");
const { protect } = require("../middleware/auth");
const { logAction } = require("../middleware/logger");

/**
 * @swagger
 * /sip/ingest:
 *   post:
 *     summary: Ingest a new SIP package
 *     tags: [SIP/AIP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               sipFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: SIP ingested successfully
 *       400:
 *         description: Invalid SIP package
 *       401:
 *         description: Not authenticated
 */
router.post("/ingest", protect, logAction("upload"), sipController.ingestSIP);

/**
 * @swagger
 * /sip/aips:
 *   get:
 *     summary: Get all AIPs
 *     tags: [SIP/AIP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filter by type
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *         description: Filter by visibility
 *     responses:
 *       200:
 *         description: List of AIPs
 *       401:
 *         description: Not authenticated
 */
router.get("/aips", protect, logAction("view"), sipController.getAIPs);

/**
 * @swagger
 * /sip/aips/{id}:
 *   get:
 *     summary: Get AIP by ID
 *     tags: [SIP/AIP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AIP details
 *       404:
 *         description: AIP not found
 *       403:
 *         description: Access denied
 */
router.get("/aips/:id", protect, logAction("view"), sipController.getAIPById);

/**
 * @swagger
 * /sip/aips/{id}/visibility:
 *   put:
 *     summary: Update AIP visibility
 *     tags: [SIP/AIP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Visibility updated
 *       404:
 *         description: AIP not found
 *       403:
 *         description: No permission
 */
router.put(
  "/aips/:id/visibility",
  protect,
  logAction("update"),
  sipController.updateAIPVisibility
);

/**
 * @swagger
 * /sip/dip/{id}/export:
 *   get:
 *     summary: Export AIP as DIP (ZIP file)
 *     tags: [DIP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: DIP ZIP file
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: AIP not found
 *       403:
 *         description: Access denied
 */
router.get(
  "/dip/:id/export",
  protect,
  logAction("export"),
  dipController.exportDIP
);

/**
 * @swagger
 * /sip/aips/{id}/files/{fileId}:
 *   get:
 *     summary: Serve individual file from AIP
 *     tags: [DIP]
 *     security:
 *       - bearerAuth: []
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
 *         description: File not found
 *       403:
 *         description: Access denied
 */
router.get(
  "/aips/:id/files/:fileId",
  protect,
  logAction("download"),
  dipController.serveFile
);

module.exports = router;
