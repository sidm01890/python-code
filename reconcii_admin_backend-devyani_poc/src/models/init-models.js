var DataTypes = require("sequelize").DataTypes;
var _Users = require("./Users");
var _activity_log = require("./activity_log");
var _authority = require("./authority");
var _group_role = require("./group_role");
var _group_user = require("./group_user");
var _groups = require("./groups");
var _groupss = require("./groupss");
var _merchant_details = require("./merchant_details");
var _modules = require("./modules");
var _orgnization = require("./orgnization");
var _permissions = require("./permissions");
var _role = require("./role");
var _role_authority = require("./role_authority");
var _service = require("./service");
var _tools = require("./tools");
var _user_details = require("./user_details");
var _user_details_history = require("./user_details_history");
var _user_role = require("./user_role");

function initModels(sequelize) {
  var Users = _Users(sequelize, DataTypes);
  var activity_log = _activity_log(sequelize, DataTypes);
  var authority = _authority(sequelize, DataTypes);
  var group_role = _group_role(sequelize, DataTypes);
  var group_user = _group_user(sequelize, DataTypes);
  var groups = _groups(sequelize, DataTypes);
  var groupss = _groupss(sequelize, DataTypes);
  var merchant_details = _merchant_details(sequelize, DataTypes);
  var modules = _modules(sequelize, DataTypes);
  var orgnization = _orgnization(sequelize, DataTypes);
  var permissions = _permissions(sequelize, DataTypes);
  var role = _role(sequelize, DataTypes);
  var role_authority = _role_authority(sequelize, DataTypes);
  var service = _service(sequelize, DataTypes);
  var tools = _tools(sequelize, DataTypes);
  var user_details = _user_details(sequelize, DataTypes);
  var user_details_history = _user_details_history(sequelize, DataTypes);
  var user_role = _user_role(sequelize, DataTypes);

  role_authority.belongsTo(authority, {
    as: "authority",
    foreignKey: "authority_id",
  });
  authority.hasMany(role_authority, {
    as: "role_authorities",
    foreignKey: "authority_id",
  });
  group_role.belongsTo(groupss, { as: "group", foreignKey: "group_id" });
  groupss.hasMany(group_role, { as: "group_roles", foreignKey: "group_id" });
  group_user.belongsTo(groupss, { as: "group", foreignKey: "group_id" });
  groupss.hasMany(group_user, { as: "group_users", foreignKey: "group_id" });
  permissions.belongsTo(modules, { as: "module", foreignKey: "module_id" });
  modules.hasMany(permissions, { as: "permissions", foreignKey: "module_id" });
  group_role.belongsTo(role, { as: "role", foreignKey: "role_id" });
  role.hasMany(group_role, { as: "group_roles", foreignKey: "role_id" });
  role_authority.belongsTo(role, { as: "role", foreignKey: "role_id" });
  role.hasMany(role_authority, {
    as: "role_authorities",
    foreignKey: "role_id",
  });
  user_role.belongsTo(role, { as: "role", foreignKey: "role_id" });
  role.hasMany(user_role, { as: "user_roles", foreignKey: "role_id" });
  authority.belongsTo(service, { as: "service", foreignKey: "service_id" });
  service.hasMany(authority, { as: "authorities", foreignKey: "service_id" });
  groups.belongsTo(tools, { as: "tool", foreignKey: "tool_id" });
  tools.hasMany(groups, { as: "groups", foreignKey: "tool_id" });
  modules.belongsTo(tools, { as: "tool", foreignKey: "tool_id" });
  tools.hasMany(modules, { as: "modules", foreignKey: "tool_id" });
  permissions.belongsTo(tools, { as: "tool", foreignKey: "tool_id" });
  tools.hasMany(permissions, { as: "permissions", foreignKey: "tool_id" });
  group_user.belongsTo(user_details, { as: "user", foreignKey: "user_id" });
  user_details.hasMany(group_user, {
    as: "group_users",
    foreignKey: "user_id",
  });
  user_details.belongsTo(user_details, {
    as: "parent_username_user_detail",
    foreignKey: "parent_username",
  });
  user_details.hasMany(user_details, {
    as: "user_details",
    foreignKey: "parent_username",
  });
  user_role.belongsTo(user_details, { as: "user", foreignKey: "user_id" });
  user_details.hasMany(user_role, { as: "user_roles", foreignKey: "user_id" });

  return {
    Users,
    activity_log,
    authority,
    group_role,
    group_user,
    groups,
    groupss,
    merchant_details,
    modules,
    orgnization,
    permissions,
    role,
    role_authority,
    service,
    tools,
    user_details,
    user_details_history,
    user_role,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
