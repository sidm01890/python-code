const db = require("../models");
const bcrypt = require("bcryptjs");
// const db = require("../models");

// const { Organization, Tool, OrganizationTool } = db;

// Validation middleware
const validateOrganization = (req, res, next) => {
  const { status } = req.body;
  if (status !== undefined && ![0, 1].includes(Number(status))) {
    return res.status(400).json({ error: "Status must be 0 or 1" });
  }
  next();
};

// Create a new Organization
exports.create = async (req, res) => {
  try {
    const {
      organization_unit_name,
      organization_full_name,
      domain_name,
      address,
      logo_url,
      status,
      username,
      email,
      mobile,
      password,
    } = req.body;

    // Check if username already exists
    const existingOrganization = await db.organization.findOne({
      where: { organization_unit_name },
    });

    if (existingOrganization) {
      return res.status(409).json({
        message: "Organization unit already exists",
        field: "organization_unit_name",
      });
    }

    // Check if username already exists
    const existingUser = await db.user_details.findOne({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username already exists",
        field: "username",
      });
    }

    // Check if username already exists
    const existingEmail = await db.user_details.findOne({
      where: { email },
    });

    if (existingEmail) {
      return res.status(409).json({
        message: "Email already exists",
        field: "email",
      });
    }

    const organization = await db.organization.create({
      organization_unit_name,
      organization_full_name,
      domain_name,
      address,
      logo_url,
      status: status ?? 1, // Default to 1 if not provided
      created_by: req.user.id,
      updated_by: req.user.id,
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      await db.user_details.create({
        username,
        password: hashedPassword,
        raw_password: password, // Note: Storing raw password is not recommended in production
        name: organization_full_name,
        email,
        mobile,
        active: true,
        organization_id: organization?.id,
        role_name: 1,
        user_label: "Admin",
        level: "1",
        created_by: req.user.username,
        updated_by: req.user.username,
      });
      res.status(201).json(organization);
    } catch (e) {
      res.status(500).json({
        message:
          e.message || "Some error occurred while creating the Organization.",
      });
    }
  } catch (error) {
    res.status(500).json({
      message:
        error.message || "Some error occurred while creating the Organization.",
    });
  }
};

// Get all Organizations
exports.findAll = async (req, res) => {
  try {
    const queryOptions = {
      include: [
        {
          model: db.organization_tool,
          as: "organization_tool",
          attributes: ["id", "organization_id", "tool_id"],
          required: false, // Ensures LEFT JOIN
          on: {
            organization_id: { [db.Sequelize.Op.col]: "organization.id" }, // Explicit join condition
          },
        },
      ],
    };
    const organizations = await db.organization.findAll(queryOptions);
    res.status(200).json({
      message: "Organization fetched successfully",
      status: 200,
      Data: organizations,
    });
  } catch (error) {
    res.status(500).json({
      message:
        error.message || "Some error occurred while retrieving organizations.",
    });
  }
};

// Find a single Organization by id
exports.findOne = async (req, res) => {
  const id = req.params.id;
  try {
    const organization = await db.organization.findByPk(id);
    if (organization) {
      res.status(200).json(organization);
    } else {
      res.status(404).json({
        message: `Organization with id=${id} not found`,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving Organization with id=" + id,
    });
  }
};

// Update an Organization
exports.update = async (req, res) => {
  try {
    const {
      id,
      organization_unit_name,
      organization_full_name,
      domain_name,
      address,
      logo_url,
      status,
    } = req.body;

    const organization = await db.organization.update(
      {
        organization_unit_name,
        organization_full_name,
        domain_name,
        address,
        logo_url,
        status,
        updated_by: req.user.id,
        updated_date: new Date(),
      },
      {
        where: { id: id },
      }
    );
    if (organization) {
      res.status(200).json({
        message: "Organization was updated successfully.",
      });
    } else {
      res.status(404).json({
        message: `Cannot update Organization with id=${id}. Organization not found!`,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error updating Organization with id=",
    });
  }
};

// Delete an Organization
exports.delete = async (req, res) => {
  const id = req.body.id;
  try {
    const num = await db.organization.destroy({
      where: { id: id },
    });
    if (num == 1) {
      res.status(200).json({
        message: "Organization was deleted successfully!",
      });
    } else {
      res.status(404).json({
        message: `Cannot delete Organization with id=${id}. Organization not found!`,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Could not delete Organization with id=" + id,
    });
  }
};

// Assign tools to an organization
exports.assignTools = async (req, res) => {
  try {
    const { organization_id, tool_ids } = req.body;
    const module_ids = req.body.module_ids;

    // Validate if organization exists
    const organization = await db.organization.findByPk(organization_id);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Get existing tool assignments
    const existingAssignments = await db.organization_tool.findAll({
      where: { organization_id, tool_id: tool_ids[0] },
      attributes: ["tool_id", "module_id"],
    });

    // Create a mapping of existing assignments for easier lookup
    const existingMapping = {};
    existingAssignments.forEach((assignment) => {
      const key = `${assignment.tool_id}-${assignment.module_id}`;
      existingMapping[key] = true;
    });

    // Determine tools and modules to add and remove
    const newMappings = [];
    const toolIdsToRemove = [];

    tool_ids.forEach((tool_id) => {
      module_ids.forEach((module_id) => {
        const key = `${tool_id}-${module_id}`;
        if (!existingMapping[key]) {
          // If the combination doesn't exist, prepare to add it
          newMappings.push({
            organization_id,
            tool_id,
            module_id,
            created_by: req.user.id,
          });
        }
      });
    });

    // Determine which existing assignments to remove
    existingAssignments.forEach((assignment) => {
      const key = `${assignment.tool_id}-${assignment.module_id}`;
      if (
        !tool_ids.includes(assignment.tool_id) ||
        !module_ids.includes(assignment.module_id)
      ) {
        toolIdsToRemove.push(key);
      }
    });

    // Create new assignments
    if (newMappings.length > 0) {
      await db.organization_tool.bulkCreate(newMappings);
    }

    // Remove old assignments
    if (toolIdsToRemove.length > 0) {
      const toolIdsToRemoveArray = toolIdsToRemove.map((key) => {
        const [tool_id, module_id] = key.split("-");
        return { tool_id, module_id };
      });
      await db.organization_tool.destroy({
        where: {
          organization_id,
          [db.Sequelize.Op.or]: toolIdsToRemoveArray.map(
            ({ tool_id, module_id }) => ({
              tool_id,
              module_id,
            })
          ),
        },
      });
    }

    return res.status(200).json({
      message: "Tools assigned successfully",
      added: newMappings.map((mapping) => ({
        tool_id: mapping.tool_id,
        module_id: mapping.module_id,
      })),
      removed: toolIdsToRemove,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get all tools for an organization
exports.getOrganizationTools = async (req, res) => {
  try {
    const { organization_id } = req.params;
    console.log("organization_id", organization_id);
    // Get all tools
    const tools = await db.tools.findAll();
    // Transform the results to add active_tool flag
    const transformedTools = await Promise.all(
      tools.map(async (tool) => {
        const exists = await db.organization_tool.findOne({
          where: {
            tool_id: tool.id,
            organization_id: organization_id,
          },
        });
        return {
          ...tool?.dataValues,
          active_tool: exists ? true : false, // Set active_tool based on existence
        };
      })
    );

    return res.status(200).json({
      message: "Tools fetched successfully",
      data: transformedTools,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getOrganizationModules = async (req, res) => {
  try {
    let { organization_id } = req.body;
    const queryOptions = {
      where: { organization_id },
    };

    const tools = await db.organization_tool.findAll(queryOptions);
    res.status(200).json({
      Message: "Tools mapping fetched successfully",
      Status: 200,
      Data: tools,
    });
  } catch (error) {
    console.error("Get tools mapping error:", error);
    res.status(500).json({ message: "Error fetching tools mapping" });
  }
};

exports.updateOrganizationModuleMapping = async (req, res) => {
  try {
    const { organization_id, organization_module_mapping } = req.body;

    if (!organization_id || !organization_module_mapping) {
      return res.status(400).json({
        message: "Organization ID and organization_module are required",
      });
    }

    // Fetch existing records for the group
    const existingMappings = await db.organization_tool.findAll({
      where: { organization_id },
      attributes: ["id", "tool_id", "module_id"],
    });

    // Convert existing mappings into a Set for easy lookup
    const existingSet = new Set(
      existingMappings.map((record) => `${record.tool_id}-${record.module_id}`)
    );

    // Track new mappings
    const newMappings = [];

    // Iterate through the request data
    for (const [tool_id, modules] of Object.entries(
      organization_module_mapping
    )) {
      for (const module_id of modules) {
        const key = `${tool_id}-${module_id}`;
        if (!existingSet.has(key)) {
          newMappings.push({
            organization_id,
            tool_id,
            module_id,
            status: 1,
            created_by: req?.user.id,
          });
        }
      }
    }

    // Insert new records if needed
    if (newMappings.length > 0) {
      await db.organization_tool.bulkCreate(newMappings);
    }

    // Identify and remove old records that are no longer in the request
    const requestSet = new Set(
      Object.entries(organization_module_mapping).flatMap(
        ([tool_id, modules]) =>
          modules.map((module_id) => `${tool_id}-${module_id}`)
      )
    );

    const recordsToDelete = existingMappings
      .filter(
        (record) => !requestSet.has(`${record.tool_id}-${record.module_id}`)
      )
      .map((record) => record.id);

    if (recordsToDelete.length > 0) {
      await db.organization_tool.destroy({
        where: { id: recordsToDelete },
      });
    }

    res.status(200).json({
      Message: "Organization mapping fetched successfully",
      Status: 200,
    });
  } catch (error) {
    console.error("Update organization module mapping error:", error);
    res
      .status(500)
      .json({ message: "Error updating organization module mapping" });
  }
};

// Get dashboard statistics for an organization
exports.getDashboardStats = async (req, res) => {
  try {
    const { organization_id, tool_id } = req.body;

    // Validate if organization exists
    const organization = await db.organization.findByPk(organization_id);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Get user statistics
    const userStats = await db.user_details.findAll({
      where: { organization_id },
      attributes: [
        [db.Sequelize.fn("COUNT", db.Sequelize.col("*")), "total_users"],
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal("CASE WHEN active = 1 THEN 1 ELSE 0 END")
          ),
          "active_users",
        ],
        [
          db.Sequelize.fn(
            "SUM",
            db.Sequelize.literal("CASE WHEN active = 0 THEN 1 ELSE 0 END")
          ),
          "inactive_users",
        ],
      ],
      raw: true,
    });

    // Get total modules count
    const totalModules = await db.organization_tool.count({
      where: { organization_id, tool_id },
    });

    // Get total groups count
    const totalGroups = await db.groups.count({
      where: { tool_id },
    });

    const dashboardStats = {
      total_users: parseInt(userStats[0].total_users) || 0,
      active_users: parseInt(userStats[0].active_users) || 0,
      inactive_users: parseInt(userStats[0].inactive_users) || 0,
      total_modules: totalModules,
      total_groups: totalGroups,
    };

    return res.status(200).json({
      message: "Dashboard statistics fetched successfully",
      Data: dashboardStats,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving dashboard statistics",
      error: error.message,
    });
  }
};
