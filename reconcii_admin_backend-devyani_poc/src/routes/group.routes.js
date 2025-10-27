const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const {
  createGroup,
  getAllGroups,
  deleteGroup,
  getGroupModules,
  updateGroupModuleMapping,
} = require("../controllers/group.controller");

/**
 * @swagger
 * components:
 *   schemas:
 *     Group:
 *       type: object
 *       required:
 *         - group_name
 *         - tool_id
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID
 *         group_name:
 *           type: string
 *           description: Name of the group
 *         tool_id:
 *           type: integer
 *           description: ID of the associated tool
 */

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Group'
 *     responses:
 *       201:
 *         description: Group created successfully
 *   get:
 *     summary: Get all groups
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Group'
 */
router.use(verifyToken);

router.post("/createGroup", isAdmin, createGroup);
router.post("/getAllGroups", getAllGroups);
router.post("/getGroupModules", getGroupModules);
router.post("/updateGroupModuleMapping", updateGroupModuleMapping);

/**
 * @swagger
 * /api/groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     tags: [Groups]
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
 *         description: Group details
 *       404:
 *         description: Group not found
 *   put:
 *     summary: Update a group
 *     tags: [Groups]
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
 *             $ref: '#/components/schemas/Group'
 *     responses:
 *       200:
 *         description: Group updated successfully
 *   delete:
 *     summary: Delete a group
 *     tags: [Groups]
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
 *         description: Group deleted successfully
 */
router.post("/deleteGroup", isAdmin, deleteGroup);

module.exports = router;
