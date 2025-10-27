const db = require("../models");
const { Permission, Module, Tool } = require("../models");

const createPermission = async (req, res) => {
  try {
    const { permission_name, permission_code, module_id, tool_id, id } =
      req.body;

    if (!permission_name || !permission_code || !module_id || !tool_id) {
      return res.status(400).json({
        message: "Permission name, code, module ID, and tool ID are required",
      });
    }

    // Check if module and tool exist
    const module = await db.modules.findByPk(module_id);
    const tool = await db.modules.findByPk(tool_id);

    if (!module || !tool) {
      return res.status(404).json({
        message: !module ? "Module not found" : "Tool not found",
      });
    }

    // Check for duplicity
    const existingRecords = await db.permissions.findAll({
      where: { permission_name, permission_code, tool_id, module_id },
    });
    if (existingRecords?.length > 0) {
      return res.status(409).json({ message: "Permission already exists." });
    }
    let permission = {};
    if (id) {
      // Update it
      permission = await db.permissions.update(
        { permission_name, permission_code, module_id, tool_id },
        { where: { id: id } }
      );
    } else {
      permission = await db.permissions.create({
        permission_name,
        permission_code,
        module_id,
        tool_id,
      });
    }

    res.status(201).json(permission);
  } catch (error) {
    console.error("Create permission error:", error);
    res.status(500).json({ message: "Error creating permission" });
  }
};

const getAllPermissions = async (req, res) => {
  try {
    const { module_id } = req.body;
    const queryOptions = {
      where: { module_id: module_id },
      order: [["created_at", "ASC"]],
      include: [
        {
          model: db.modules,
          as: "modules",
          attributes: ["id", "module_name"],
        },
        {
          model: db.tools,
          as: "tools",
          attributes: ["id", "tool_name"],
        },
      ],
    };

    const permissions = await db.permissions.findAll(queryOptions);
    res.status(200).json({
      Message: "Permission fetched successfully",
      Status: 200,
      Data: permissions,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching permissions" });
  }
};

const deletePermission = async (req, res) => {
  try {
    const permission = await db.permissions.findByPk(req.body.id);

    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    // check if this permission is already assigned to someone
    // To-Do

    await permission.destroy();
    res.status(200).json({ message: "Permission deleted successfully" });
  } catch (error) {
    console.error("Delete permission error:", error);
    res.status(500).json({ message: "Error deleting permission" });
  }
};

module.exports = {
  createPermission,
  getAllPermissions,
  deletePermission,
};
