const { where } = require("sequelize");
const db = require("../models");
const { Group, Tool } = require("../models");

const createGroup = async (req, res) => {
  try {
    const { group_name, tool_id, id, organization_id } = req.body;

    if (!group_name || !tool_id) {
      return res
        .status(400)
        .json({ message: "Group name and tool ID are required" });
    }

    // Check if tool exists
    const tool = await db.tools.findByPk(tool_id);
    if (!tool) {
      return res.status(404).json({ message: "Tool not found" });
    }

    // Check duplicates
    const existingRecords = await db.groups.findAll({
      where: { group_name, tool_id, organization_id },
    });
    if (existingRecords?.length > 0) {
      return res.status(409).json({ message: "Group already exists." });
    }

    let group = {};

    if (id) {
      // Update it
      group = await db.groups.update(
        {
          group_name,
          tool_id,
          organization_id,
          created_by: req.user.id,
          updated_by: req.user.id,
        },
        { where: { id: id } }
      );
    } else {
      group = await db.groups.create({
        group_name,
        tool_id,
        organization_id,
        created_by: req.user.id,
        updated_by: req.user.id,
      });
    }
    res.status(201).json(group);
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({ message: "Error creating group" });
  }
};

const getAllGroups = async (req, res) => {
  try {
    let { tool_id, organization_id } = req.body;
    const queryOptions = {
      where: { tool_id, organization_id },
      order: [["created_at", "ASC"]],
      include: [
        {
          model: db.tools,
          as: "tools",
          attributes: ["id", "tool_name"],
        },
        {
          model: db.group_module_mapping,
          as: "group_module_mapping",
          attributes: ["id", "group_id", "module_id"],
          required: false, // Ensures LEFT JOIN
          on: {
            group_id: { [db.Sequelize.Op.col]: "groups.id" }, // Explicit join condition
          },
        },
        {
          model: db.user_details,
          as: "users",
          attributes: ["id", "username", "name", "email", "mobile", "active"], // Add any other user attributes you want to include
          required: false, // Makes it a LEFT JOIN
        },
      ],
    };

    const groups = await db.groups.findAll(queryOptions);
    res.status(200).json({
      Message: "Groups fetched successfully",
      Status: 200,
      Data: groups,
    });
  } catch (error) {
    console.error("Get modules error:", error);
    res.status(500).json({ message: "Error fetching modules" });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const group = await db.groups.findByPk(req.body.id);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // check if this group has already assigned to users
    // To-Do

    await group.destroy();
    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({ message: "Error deleting group" });
  }
};

const getGroupModules = async (req, res) => {
  try {
    let { group_id } = req.body;
    const queryOptions = {
      where: { group_id },
    };

    const groups = await db.group_module_mapping.findAll(queryOptions);
    res.status(200).json({
      Message: "Group mapping fetched successfully",
      Status: 200,
      Data: groups,
    });
  } catch (error) {
    console.error("Get group mapping error:", error);
    res.status(500).json({ message: "Error fetching group mapping" });
  }
};

const updateGroupModuleMapping = async (req, res) => {
  try {
    const { group_id, module_permission_mapping } = req.body;

    if (!group_id || !module_permission_mapping) {
      return res
        .status(400)
        .json({ message: "Group ID and module permissions are required" });
    }

    // Fetch existing records for the group
    const existingMappings = await db.group_module_mapping.findAll({
      where: { group_id },
      attributes: ["id", "module_id", "permission_id"],
    });

    // Convert existing mappings into a Set for easy lookup
    const existingSet = new Set(
      existingMappings.map(
        (record) => `${record.module_id}-${record.permission_id}`
      )
    );

    // Track new mappings
    const newMappings = [];

    // Iterate through the request data
    for (const [module_id, permissions] of Object.entries(
      module_permission_mapping
    )) {
      for (const permission_id of permissions) {
        const key = `${module_id}-${permission_id}`;
        if (!existingSet.has(key)) {
          newMappings.push({ group_id, module_id, permission_id });
        }
      }
    }

    // Insert new records if needed
    if (newMappings.length > 0) {
      await db.group_module_mapping.bulkCreate(newMappings);
    }

    // Identify and remove old records that are no longer in the request
    const requestSet = new Set(
      Object.entries(module_permission_mapping).flatMap(
        ([module_id, permissions]) =>
          permissions.map((permission_id) => `${module_id}-${permission_id}`)
      )
    );

    const recordsToDelete = existingMappings
      .filter(
        (record) =>
          !requestSet.has(`${record.module_id}-${record.permission_id}`)
      )
      .map((record) => record.id);

    if (recordsToDelete.length > 0) {
      await db.group_module_mapping.destroy({
        where: { id: recordsToDelete },
      });
    }

    res.status(200).json({
      Message: "Group mapping fetched successfully",
      Status: 200,
    });
  } catch (error) {
    console.error("Update group module mapping error:", error);
    res.status(500).json({ message: "Error updating group module mapping" });
  }
};

module.exports = {
  createGroup,
  getAllGroups,
  deleteGroup,
  getGroupModules,
  updateGroupModuleMapping,
};
