const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const { protect } = require("../middleware/auth");
const { logAction } = require("../middleware/logger");

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         aip:
 *           type: string
 *         author:
 *           type: object
 *         content:
 *           type: string
 *         isPrivate:
 *           type: boolean
 *         parentComment:
 *           type: string
 *         replies:
 *           type: array
 *         createdAt:
 *           type: string
 *         updatedAt:
 *           type: string
 */

/**
 * @swagger
 * /comments/aip/{aipId}:
 *   post:
 *     summary: Create a comment for an AIP
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: aipId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               isPrivate:
 *                 type: boolean
 *                 default: true
 *               parentComment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       403:
 *         description: No permission to comment
 *       404:
 *         description: AIP not found
 */
router.post(
  "/aip/:aipId",
  protect,
  logAction("create"),
  commentController.createComment
);

/**
 * @swagger
 * /comments/aip/{aipId}:
 *   get:
 *     summary: Get comments for an AIP
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: aipId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of comments
 *       403:
 *         description: No permission to view comments
 *       404:
 *         description: AIP not found
 */
router.get(
  "/aip/:aipId",
  protect,
  logAction("view"),
  commentController.getCommentsByAIP
);

/**
 * @swagger
 * /comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
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
 *               content:
 *                 type: string
 *               isPrivate:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       403:
 *         description: No permission to update
 *       404:
 *         description: Comment not found
 */
router.put(
  "/:id",
  protect,
  logAction("update"),
  commentController.updateComment
);

/**
 * @swagger
 * /comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
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
 *         description: Comment deleted successfully
 *       403:
 *         description: No permission to delete
 *       404:
 *         description: Comment not found
 */
router.delete(
  "/:id",
  protect,
  logAction("delete"),
  commentController.deleteComment
);

module.exports = router;
