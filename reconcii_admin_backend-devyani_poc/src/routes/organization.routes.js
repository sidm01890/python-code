const router = require("express").Router();
const organizations = require("../controllers/organization.controller.js");
const { verifyToken } = require("../middleware/auth.middleware.js");

router.use(verifyToken);
// Create a new Organization
router.post("/create", organizations.create);

// Retrieve all Organizations
router.get("/all", organizations.findAll);

// Update an Organization with id
router.post("/update", organizations.update);

// Delete an Organization with id
router.delete("/delete", organizations.delete);

router.post("/tools/assign", organizations.assignTools);

// Get all tools for an organization
router.get("/tools/:organization_id", organizations.getOrganizationTools);

// Get all tools for an organization
router.post("/dashboard", organizations.getDashboardStats);

router.post("/getOrganizationModules", organizations.getOrganizationModules);

router.post(
  "/updateOrganizationModules",
  organizations.updateOrganizationModuleMapping
);

module.exports = router;
