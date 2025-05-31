const express = require("express");
const router = express.Router();
const socialController = require("../controllers/socialController");
const { protect } = require("../middleware/auth");

/**
 * @swagger
 * /social/{id}/links:
 *   get:
 *     summary: Get social sharing links for AIP
 *     tags: [Social]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id/links", protect, socialController.getSocialLinks);

module.exports = router;
