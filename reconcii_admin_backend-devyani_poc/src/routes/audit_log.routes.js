const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth.middleware");
const {
  createLog,
  getAuditLogs,
  getAllOrganizationUsers,
} = require("../controllers/audit_log.controller");

router.use(verifyToken);

router.post("/create", isAdmin, createLog);

router.post("/list", isAdmin, getAuditLogs);

router.get("/user/list", isAdmin, getAllOrganizationUsers);

module.exports = router;
