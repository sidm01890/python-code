const db = require("../models");

const createModule = async (req, res) => {
  try {
    const { module_name, tool_id, id } = req.body;

    if (!module_name || !tool_id) {
      return res
        .status(400)
        .json({ message: "Module name and tool ID are required" });
    }

    // Check if tool exists
    const tool = await db.tools.findByPk(tool_id);
    if (!tool) {
      return res.status(404).json({ message: "Tool not found" });
    }

    // Check duplicates
    const existingRecords = await db.modules.findAll({
      where: { module_name, tool_id },
    });
    if (existingRecords?.length > 0) {
      return res.status(409).json({ message: "Module already exists." });
    }

    let module = {};
    if (id) {
      module = await db.modules.update(
        { module_name, tool_id },
        { where: { id: id } }
      );
    } else {
      module = await db.modules.create({ module_name, tool_id });
    }
    res.status(201).json(module);
  } catch (error) {
    console.error("Create module error:", error);
    res.status(500).json({ message: "Error creating module" });
  }
};

const getAllModules = async (req, res) => {
  try {
    let { tool_id, organization_id } = req.body;

    let queryOptions = {
      where: {},
      order: [["created_at", "ASC"]],
      include: [
        {
          model: db.tools,
          as: "tools",
          attributes: ["id", "tool_name"],
          on: {
            id: { [db.Sequelize.Op.col]: "modules.tool_id" }, // Explicit join condition
          },
        },
        {
          model: db.permissions,
          as: "permissions",
          required: false, // Ensures LEFT JOIN
          on: {
            module_id: { [db.Sequelize.Op.col]: "modules.id" }, // Explicit join condition
          },
        },
      ],
    };

    if (organization_id && organization_id !== "0") {
      queryOptions.include.push({
        model: db.organization_tool,
        as: "organization_tool",
        attributes: [],
        required: true, // Ensures INNER JOIN
        on: {
          module_id: { [db.Sequelize.Op.col]: "modules.id" }, // Explicit join condition
        },
        where: {
          tool_id: tool_id,
          organization_id: organization_id,
        },
      });
    } else {
      queryOptions.where.tool_id = tool_id; // Only filter by tool_id if organization_id is not provided
    }

    const modules = await db.modules.findAll(queryOptions);
    res.status(200).json({
      Message: "Modules fetched successfully",
      Status: 200,
      Data: modules,
    });
  } catch (error) {
    console.error("Get modules error:", error);
    res.status(500).json({ message: "Error fetching modules" });
  }
};

const deleteModule = async (req, res) => {
  try {
    const module = await db.modules.findByPk(req.body.id);

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Check if this module has permissions
    const existingPermissions = await db.permissions.findAll({
      where: { module_id: req.body.id },
    });
    if (existingPermissions?.length > 0) {
      return res
        .status(409)
        .json({ message: "You have existing permissions for this module." });
    }
    // check if this group has already assigned to users
    // To-Do

    await module.destroy();
    res.status(200).json({ message: "Module deleted successfully" });
  } catch (error) {
    console.error("Delete module error:", error);
    res.status(500).json({ message: "Error deleting module" });
  }
};

module.exports = {
  createModule,
  getAllModules,
  deleteModule,
};
