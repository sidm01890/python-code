const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const {
  createUser,
  updateUser,
  deleteUser,
  updatePassword,
  getAllUsers,
  updateUserModuleMapping,
  getUserModules,
} = require("../controllers/user.controller");

router.use(verifyToken);

// Create new user (admin only)
router.post("/createUser", isAdmin, createUser);

// Update user
router.post("/updateUser", isAdmin, updateUser);

// Delete user
router.post("/deleteUser", isAdmin, deleteUser);

// Change password
router.post("/updatePassword", updatePassword);

// Get all users
router.post("/getAllUsers", getAllUsers);

// Update user module mapping
router.post("/updateUserModuleMapping", updateUserModuleMapping);

// Get user modules
router.post("/getUserModules", getUserModules);

module.exports = router;
