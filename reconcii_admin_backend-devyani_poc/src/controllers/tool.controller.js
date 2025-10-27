const db = require("../models");

const createTool = async (req, res) => {
  try {
    const { tool_name, tool_logo, tool_url, tool_status } = req.body;

    if (!tool_name) {
      return res.status(400).json({ message: "Tool name is required" });
    }

    // Check duplicates
    const existingTool = await db.tools.findOne({
      where: { tool_name },
    });
    if (existingTool) {
      return res.status(409).json({ message: "Tool already exists" });
    }

    const tool = await db.tools.create({
      tool_name,
      tool_logo,
      tool_url,
      tool_status: tool_status ?? 1,
    });
    res.status(201).json(tool);
  } catch (error) {
    console.error("Create tool error:", error);
    res.status(500).json({ message: "Error creating tool" });
  }
};

const getAllTools = async (req, res) => {
  try {
    const tools = await db.tools.findAll({
      order: [["created_at", "ASC"]],
      include: [
        {
          model: db.modules,
          attributes: ["id", "module_name"],
          as: "modules",
          required: false,
          on: {
            tool_id: { [db.Sequelize.Op.col]: "tools.id" }, // Explicit join condition
          },
          order: [["id", "ASC"]],
        },
      ],
    });

    res.status(200).json({
      message: "Tools fetched successfully",
      status: 200,
      Data: tools,
    });
  } catch (error) {
    console.error("Get tools error:", error);
    res.status(500).json({ message: "Error fetching tools" });
  }
};

const getToolById = async (req, res) => {
  try {
    const tool = await db.tools.findByPk(req.params.id);

    if (!tool) {
      return res.status(404).json({ message: "Tool not found" });
    }

    res.status(200).json(tool);
  } catch (error) {
    console.error("Get tool error:", error);
    res.status(500).json({ message: "Error fetching tool" });
  }
};

const updateTool = async (req, res) => {
  try {
    const { id, tool_name, tool_logo, tool_url, tool_status } = req.body;
    const tool = await db.tools.findByPk(id);

    if (!tool) {
      return res.status(404).json({ message: "Tool not found" });
    }

    // Check if new name conflicts with existing tool
    if (tool_name && tool_name !== tool.tool_name) {
      const existingTool = await db.tools.findOne({
        where: { tool_name },
      });
      if (existingTool) {
        return res.status(409).json({ message: "Tool name already exists" });
      }
    }

    await tool.update({
      tool_name,
      tool_logo,
      tool_url,
      tool_status: tool_status !== undefined ? tool_status : tool.tool_status,
    });
    res.status(200).json(tool);
  } catch (error) {
    console.error("Update tool error:", error);
    res.status(500).json({ message: "Error updating tool" });
  }
};

const deleteTool = async (req, res) => {
  try {
    const tool = await db.tools.findByPk(req.body.id);

    if (!tool) {
      return res.status(404).json({ message: "Tool not found" });
    }

    // You might want to check for related modules before deletion
    const existingModules = await db.modules.findAll({
      where: { tool_id: req.body.id },
    });
    if (existingModules?.length > 0) {
      return res
        .status(409)
        .json({ message: "Cannot delete tool with existing modules" });
    }

    await tool.destroy();
    res.status(200).json({ message: "Tool deleted successfully" });
  } catch (error) {
    console.error("Delete tool error:", error);
    res.status(500).json({ message: "Error deleting tool" });
  }
};

module.exports = {
  createTool,
  getAllTools,
  getToolById,
  updateTool,
  deleteTool,
};
