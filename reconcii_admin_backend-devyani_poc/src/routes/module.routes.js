const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const {
  createModule,
  getAllModules,
  updateModule,
  deleteModule,
} = require("../controllers/module.controller");

/**
 * @swagger
 * components:
 *   schemas:
 *     Module:
 *       type: object
 *       required:
 *         - module_name
 *         - tool_id
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID
 *         module_name:
 *           type: string
 *           description: Name of the module
 *         tool_id:
 *           type: integer
 *           description: ID of the associated tool
 */

/**
 * @swagger
 * /api/modules:
 *   post:
 *     summary: Create a new module
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - module_name
 *               - tool_id
 *             properties:
 *               module_name:
 *                 type: string
 *               tool_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Module created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   get:
 *     summary: Get all modules
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of modules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Module'
 */
router.use(verifyToken);

router.post("/createModule", isAdmin, createModule);
router.post("/getAllModules", getAllModules);

/**
 * @swagger
 * /api/modules/{id}:
 *   get:
 *     summary: Get module by ID
 *     tags: [Modules]
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
 *         description: Module details
 *       404:
 *         description: Module not found
 *   put:
 *     summary: Update a module
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               module_name:
 *                 type: string
 *               tool_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Module updated successfully
 *       404:
 *         description: Module not found
 *   delete:
 *     summary: Delete a module
 *     tags: [Modules]
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
 *         description: Module deleted successfully
 *       404:
 *         description: Module not found
 */
router.post("/deleteModule", isAdmin, deleteModule);

module.exports = router;
