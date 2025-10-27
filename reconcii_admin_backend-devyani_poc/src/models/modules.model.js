const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const Module = sequelize.define(
    "modules",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      module_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      tool_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "tools",
          key: "id",
        },
      },
    },
    {
      sequelize,
      tableName: "modules",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "tool_id",
          using: "BTREE",
          fields: [{ name: "tool_id" }],
        },
      ],
    }
  );

  Module.associate = (models) => {
    Module.belongsTo(models.tools, {
      foreignKey: "id",
      as: "tools",
    });
    Module.belongsTo(models.organization_tool, {
      foreignKey: "id",
      as: "organization_tool",
    });
    Module.hasMany(models.permissions, {
      foreignKey: "id",
      as: "permissions",
    });
  };

  return Module;
};
