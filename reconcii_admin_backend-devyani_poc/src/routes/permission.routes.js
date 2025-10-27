const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const {
  createPermission,
  getAllPermissions,
  deletePermission,
} = require("../controllers/permission.controller");

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       required:
 *         - permission_name
 *         - permission_code
 *         - module_id
 *         - tool_id
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID
 *         permission_name:
 *           type: string
 *           description: Name of the permission
 *         permission_code:
 *           type: string
 *           description: Unique code for the permission
 *         module_id:
 *           type: integer
 *           description: ID of the associated module
 *         tool_id:
 *           type: integer
 *           description: ID of the associated tool
 */

/**
 * @swagger
 * /api/permissions:
 *   post:
 *     summary: Create a new permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Permission'
 *     responses:
 *       201:
 *         description: Permission created successfully
 *   get:
 *     summary: Get all permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Permission'
 */
router.use(verifyToken);

router.post("/createPermission", isAdmin, createPermission);
router.post("/getAllPermissions", getAllPermissions);

/**
 * @swagger
 * /api/permissions/{id}:
 *   get:
 *     summary: Get permission by ID
 *     tags: [Permissions]
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
 *         description: Permission details
 *       404:
 *         description: Permission not found
 *   put:
 *     summary: Update a permission
 *     tags: [Permissions]
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
 *             $ref: '#/components/schemas/Permission'
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *   delete:
 *     summary: Delete a permission
 *     tags: [Permissions]
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
 *         description: Permission deleted successfully
 */
router.post("/deletePermission", isAdmin, deletePermission);

module.exports = router;
