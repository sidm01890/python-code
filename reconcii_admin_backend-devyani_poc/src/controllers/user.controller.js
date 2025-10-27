const db = require("../models");
const bcrypt = require("bcryptjs");

// Create new user
const createUser = async (req, res) => {
  try {
    const {
      username,
      password,
      name,
      email,
      mobile,
      organization_id,
      group_id,
      role_name = 1,
      user_label = "user",
      level = 1,
    } = req.body;

    // Validate required fields
    if (!username || !password || !name || !email || !organization_id) {
      return res.status(400).json({
        message: "Required fields missing",
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user_details.create({
      username,
      password: hashedPassword,
      raw_password: password, // Note: Storing raw password is not recommended in production
      name,
      email,
      mobile,
      active: true,
      organization_id,
      group_id,
      role_name,
      user_label,
      level,
      created_by: req.user.username,
      updated_by: req.user.username,
    });

    // Remove password from response
    const { password: _, raw_password: __, ...userResponse } = user.toJSON();

    res.status(201).json({
      message: "User created successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Error creating user" });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id, name, mobile, organization_id, group_id, active } = req.body;

    const user = await db.user_details.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.update({
      name: name || user.name,
      mobile: mobile || user.mobile,
      organization_id: organization_id || user.organization_id,
      group_id: group_id || user.group_id,
      active: active !== undefined ? active : user.active,
      updated_by: req.user.username,
    });

    // Remove sensitive data from response
    const { password, raw_password, ...userResponse } = user.toJSON();

    res.json({
      message: "User updated successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Error updating user" });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db.user_details.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optional: Check for dependencies before deletion
    // const userDependencies = await checkUserDependencies(id);
    // if (userDependencies) {
    //   return res.status(409).json({ message: "User has active dependencies" });
    // }

    await user.destroy();

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
};

// Change password
const updatePassword = async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return res.status(400).json({
        message: "User ID and password are required",
      });
    }

    const user = await db.user_details.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    await user.update({
      password: hashedPassword,
      raw_password: password, // Note: Storing raw password is not recommended in production
      updated_by: req.user.username,
    });

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Error changing password" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    let { organization_id } = req.body;
    const queryOptions = {
      attributes: {
        exclude: [
          "password",
          "raw_password",
          "created_by",
          "updated_by",
          "updated_date",
          "user_label",
          "role_name",
          "refresh_token",
          "parent_username",
          "level",
          "access_token",
          "created_date",
        ],
      },
      where: { organization_id },
      include: [
        {
          model: db.groups,
          as: "groups",
          required: false, // Ensures LEFT JOIN
          on: {
            id: { [db.Sequelize.Op.col]: "user_details.group_id" }, // Explicit join condition
          },
        },
      ],
    };

    const users = await db.user_details.findAll(queryOptions);
    res.status(200).json({
      Message: "Users fetched successfully",
      Status: 200,
      Data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

const getUserModules = async (req, res) => {
  try {
    let { user_id } = req.body;
    const queryOptions = {
      where: { user_id },
    };

    const users = await db.user_module_mapping.findAll(queryOptions);
    res.status(200).json({
      Message: "User mapping fetched successfully",
      Status: 200,
      Data: users,
    });
  } catch (error) {
    console.error("Get user mapping error:", error);
    res.status(500).json({ message: "Error fetching user mapping" });
  }
};

const updateUserModuleMapping = async (req, res) => {
  try {
    const { user_id, module_permission_mapping } = req.body;

    if (!user_id || !module_permission_mapping) {
      return res
        .status(400)
        .json({ message: "User ID and module permissions are required" });
    }

    // Fetch existing records for the group
    const existingMappings = await db.user_module_mapping.findAll({
      where: { user_id },
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
          newMappings.push({ user_id, module_id, permission_id });
        }
      }
    }

    // Insert new records if needed
    if (newMappings.length > 0) {
      await db.user_module_mapping.bulkCreate(newMappings);
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
      await db.user_module_mapping.destroy({
        where: { id: recordsToDelete },
      });
    }

    res.status(200).json({
      Message: "User mapping fetched successfully",
      Status: 200,
    });
  } catch (error) {
    console.error("Update user module mapping error:", error);
    res.status(500).json({ message: "Error updating user module mapping" });
  }
};

module.exports = {
  createUser,
  updateUser,
  deleteUser,
  updatePassword,
  getAllUsers,
  updateUserModuleMapping,
  getUserModules,
};
