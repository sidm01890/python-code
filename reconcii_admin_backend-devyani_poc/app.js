const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./src/config/swagger.config");
const cron = require("node-cron");
// Import middleware
// const logger = require("./src/middleware/logger.middleware");
// const { errorHandler, notFound } = require("./src/middleware/error.middleware");

// Import routes
const moduleRoutes = require("./src/routes/module.routes");
const groupRoutes = require("./src/routes/group.routes");
const permissionRoutes = require("./src/routes/permission.routes");
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const toolRoutes = require("./src/routes/tool.routes");
const organizationRoutes = require("./src/routes/organization.routes");
const auditLogRoutes = require("./src/routes/audit_log.routes");
const uploaderRoutes = require("./src/routes/uploader.routes");

const recoRoutes = require("./src/routes/reco.routes");

// const reconciliationRoutes = require("./src/routes/reconciliation.routes");
const { update_subscriptions } = require("./src/controllers/auth.controller");
const {
  checkReconciliationStatus,
} = require("./src/controllers/reco.controller");
const {
  populateSheetDataTables,
} = require("./src/controllers/sheetData.controller");
// Import database
//const sequelize = require("./src/config/db.config");

// Load environment variables
dotenv.config();

// Initialize express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(logger);

app.use((req, res, next) => {
  console.log("CORS Headers:", res.getHeaders());
  next();
});

// Routes
app.use("/api/module", moduleRoutes);
app.use("/api/permission", permissionRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/tool", toolRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/audit_log", auditLogRoutes);
app.use("/api/uploader", uploaderRoutes);

app.use("/api/node/reconciliation", recoRoutes);
// app.use("/api/node/reconciliation", reconciliationRoutes);
// Swagger documentation route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Error handling
// app.use(notFound);
// app.use(errorHandler);

cron.schedule("0 0,12 * * *", async () => {
  console.log("Running subscription renewal job...");
  await update_subscriptions();
});

// Run reconciliation after 30 seconds on startup
// setTimeout(async () => {
//   console.log("Running initial reconciliation...");
// await checkReconciliationStatus();
// await populateSheetDataTables(); //populateSheetDataTables
//   console.log("Initial reconciliation completed");
// }, 10000);

// Database connection and server startup
const PORT = process.env.PORT || 8034;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
