const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const {
  createTool,
  getAllTools,
  getToolById,
  updateTool,
  deleteTool,
} = require("../controllers/tool.controller");

/**
 * @swagger
 * components:
 *   schemas:
 *     Tool:
 *       type: object
 *       required:
 *         - tool_name
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID
 *         tool_name:
 *           type: string
 *           description: Name of the tool
 *         tool_logo:
 *           type: string
 *           description: URL of the tool logo image
 */

/**
 * @swagger
 * /api/tools:
 *   post:
 *     summary: Create a new tool
 *     tags: [Tools]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tool_name
 *               - tool_logo
 *             properties:
 *               tool_name:
 *                 type: string
 *               tool_logo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tool created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   get:
 *     summary: Get all tools
 *     tags: [Tools]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tools
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tool'
 */
router.use(verifyToken); // Protect all routes

router.post("/createTool", isAdmin, createTool);
router.get("/getAllTools", getAllTools);

/**
 * @swagger
 * /api/tools/{id}:
 *   get:
 *     summary: Get tool by ID
 *     tags: [Tools]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tool details
 *       404:
 *         description: Tool not found
 */
router.get("/getToolById", getToolById);
router.post("/updateTool", isAdmin, updateTool);
router.post("/deleteTool", isAdmin, deleteTool);

module.exports = router;
