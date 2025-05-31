// backend/src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect, admin } = require("../middleware/auth");
const { logAction } = require("../middleware/logger");

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", protect, admin, logAction("view"), userController.getAllUsers);

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     summary: Update user role (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/role",
  protect,
  admin,
  logAction("update"),
  userController.updateUserRole
);

module.exports = router;
