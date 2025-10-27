// Importing and defining DB configs
const config = require("../config/db.config.js");

const Sequelize = require("sequelize");

// Create Sequelize instance for bercos_sso database
const bercosSsoSequelize = new Sequelize(
  config.bercosSso.DB,
  config.bercosSso.USER,
  config.bercosSso.PASSWORD,
  {
    host: config.bercosSso.HOST,
    dialect: config.bercosSso.dialect,
    port: config.bercosSso.PORT,
    pool: config.bercosSso.pool,
    logging: config.bercosSso.logging,
    dialectOptions: config.bercosSso.dialectOptions,
    define: config.bercosSso.define,
  }
);

// Create Sequelize instance for bercos database
const bercosSequelize = new Sequelize(
  config.bercos.DB,
  config.bercos.USER,
  config.bercos.PASSWORD,
  {
    host: config.bercos.HOST,
    dialect: config.bercos.dialect,
    port: config.bercos.PORT,
    pool: config.bercos.pool,
    logging: config.bercos.logging,
    dialectOptions: config.bercos.dialectOptions,
    define: config.bercos.define,
  }
);

// Test the connections
const testConnections = async () => {
  try {
    await bercosSsoSequelize.authenticate();
    console.log(
      "Connection to bercos_sso database has been established successfully."
    );

    await bercosSequelize.authenticate();
    console.log(
      "Connection to bercos database has been established successfully."
    );
  } catch (error) {
    console.error("Unable to connect to the databases:", error);
  }
};

testConnections();

const db = {
  bercosSso: bercosSsoSequelize,
  bercos: bercosSequelize,
  Sequelize: Sequelize,
};

// Importing existing models - using bercos_sso as default
db.activity_log = require("./activity_log.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.authority = require("./authority.model.js")(bercosSsoSequelize, Sequelize);
db.group_role = require("./group_role.model.js")(bercosSsoSequelize, Sequelize);
db.group_user = require("./group_user.model.js")(bercosSsoSequelize, Sequelize);
db.groups = require("./groups.model.js")(bercosSsoSequelize, Sequelize);
db.merchant_details = require("./merchant_details.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.modules = require("./modules.model.js")(bercosSsoSequelize, Sequelize);
db.group_module_mapping = require("./group_module_mapping.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.organization = require("./organization.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.organization_tool = require("./organization_tool.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.permissions = require("./permissions.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.role_authority = require("./role_authority.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.role = require("./role.model.js")(bercosSsoSequelize, Sequelize);
db.service = require("./service.model.js")(bercosSsoSequelize, Sequelize);
db.tools = require("./tools.model.js")(bercosSsoSequelize, Sequelize);
db.user_details_history = require("./user_details_history.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.user_details = require("./user_details.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.user_role = require("./user_role.model.js")(bercosSsoSequelize, Sequelize);
db.user_module_mapping = require("./user_module_mapping.model.js")(
  bercosSsoSequelize,
  Sequelize
);
db.audit_log = require("./audit_log.model.js")(bercosSsoSequelize, Sequelize);
db.subscriptions = require("./subscriptions.modal.js")(
  bercosSsoSequelize,
  Sequelize
);

// Import models that use bercos database
db.orders = require("./orders.model.js")(bercosSequelize, Sequelize);
db.zomato = require("./zomato.model.js")(bercosSequelize, Sequelize);
db.zomato_receivables_vs_receipts =
  require("./zomato_receivables_vs_receipts.model.js")(
    bercosSequelize,
    Sequelize
  );
db.bank_statement = require("./bank_statement.model.js")(
  bercosSequelize,
  Sequelize
);
db.threepo_dashboard = require("./threepo_dashboard.model.js")(
  bercosSequelize,
  Sequelize
);
db.store = require("./store.model.js")(bercosSequelize, Sequelize);
db.zomato_mappings = require("./zomato_mappings.model.js")(
  bercosSequelize,
  Sequelize
);
db.reco_logics = require("./reco_logics.model.js")(bercosSequelize, Sequelize);

db.zomato_vs_pos_summary = require("./zomato_vs_pos_summary.model.js")(
  bercosSequelize,
  Sequelize
);
// Import models that use bercos database
db.table_columns_mapping = require("./table_columns_mapping.model.js")(
  bercosSequelize,
  Sequelize
);

db.customised_db_fields = require("./customised_db_fields.model.js")(
  bercosSequelize,
  Sequelize
);

db.trm_mpr = require("./trm_mpr.model.js")(bercosSequelize, Sequelize);
db.summarised_trm_data = require("./summarised_trm_data.model.js")(
  bercosSequelize,
  Sequelize
);
db.pos_vs_trm_summary = require("./pos_vs_trm_summary.model.js")(
  bercosSequelize,
  Sequelize
);
db.excel_generation = require("./excel_generation.model.js")(
  bercosSequelize,
  Sequelize
);

db.upload_logs = require("./upload_logs.model.js")(bercosSequelize, Sequelize);

db.trm = require("./trm.model.js")(bercosSequelize, Sequelize);
db.mpr_hdfc_card = require("./mpr_hdfc_card.model.js")(
  bercosSequelize,
  Sequelize
);
db.mpr_hdfc_upi = require("./mpr_hdfc_upi.model.js")(
  bercosSequelize,
  Sequelize
);
db.pizzahut_orders = require("./pizzahut_orders.model.js")(
  bercosSequelize,
  Sequelize
);
db.devyani_store = require("./devyani_store.model.js")(
  bercosSequelize,
  Sequelize
);

db.devyani_city = require("./devyani_city.model.js")(
  bercosSequelize,
  Sequelize
);

db.devyani_city = require("./devyani_city.model.js")(
  bercosSequelize,
  Sequelize
);

db.dynamic_formulas = require("./dynamic_formulas.model.js")(
  bercosSequelize,
  Sequelize
);

const {
  ZomatoPosVs3poData,
  Zomato3poVsPosData,
  Zomato3poVsPosRefundData,
  OrdersNotInPosData,
  OrdersNotIn3poData,
} = require("./sheetData.model.js")(bercosSequelize, Sequelize);

(db.zomato_pos_vs_3po_data = ZomatoPosVs3poData),
  (db.zomato_3po_vs_pos_data = Zomato3poVsPosData),
  (db.zomato_3po_vs_pos_refund_data = Zomato3poVsPosRefundData),
  (db.orders_not_in_pos_data = OrdersNotInPosData),
  (db.orders_not_in_3po_data = OrdersNotIn3poData),
  // Call associate if it exists
  Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

module.exports = db;
