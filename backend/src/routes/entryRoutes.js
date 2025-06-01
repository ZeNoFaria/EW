const express = require("express");
const router = express.Router();
const entryController = require("../controllers/entryController");
const { protect, optionalAuth } = require("../middleware/auth");
const { logAction } = require("../middleware/logger");

/**
 * @swagger
 * components:
 *   schemas:
 *     Entry:
 *       type: object
 *       required:
 *         - title
 *         - content
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the entry
 *         title:
 *           type: string
 *           description: The title of the entry
 *         content:
 *           type: string
 *           description: The content of the entry
 *         date:
 *           type: string
 *           format: date
 *           description: The date of the entry
 *         category:
 *           type: string
 *           description: The category id of the entry
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of tag IDs
 */

/**
 * @swagger
 * /entries/{id}:
 *   get:
 *     summary: Get entry by ID
 *     tags: [Entries]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The entry id
 *     responses:
 *       200:
 *         description: The entry by id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Entry'
 *       404:
 *         description: Entry not found
 */
router.get("/:id", protect, logAction("view"), entryController.getEntryById);

/**
 * @swagger
 * /entries/{id}:
 *   put:
 *     summary: Update an entry
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The entry id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Entry'
 *     responses:
 *       200:
 *         description: The updated entry
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Entry not found
 */
router.put("/:id", protect, logAction("update"), entryController.updateEntry);

/**
 * @swagger
 * /entries/{id}:
 *   delete:
 *     summary: Delete an entry
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The entry id
 *     responses:
 *       200:
 *         description: Entry deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Entry not found
 */
router.delete(
  "/:id",
  protect,
  logAction("delete"),
  entryController.deleteEntry
);

/**
 * @swagger
 * /entries:
 *   get:
 *     summary: Get all entries
 *     tags: [Entries]
 *     responses:
 *       200:
 *         description: The list of entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Entry'
 */
router.get("/", optionalAuth, entryController.getAllEntries);

/**
 * @swagger
 * /entries:
 *   post:
 *     summary: Create a new entry
 *     tags: [Entries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Entry'
 *     responses:
 *       201:
 *         description: The created entry
 *       401:
 *         description: Not authenticated
 */
router.post("/", protect, logAction("create"), entryController.createEntry);

module.exports = router;
