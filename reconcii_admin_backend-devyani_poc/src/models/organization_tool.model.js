const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "organization_tool",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "organization",
          key: "id",
        },
      },
      tool_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "tools",
          key: "id",
        },
      },
      module_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "modules",
          key: "id",
        },
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 1,
        comment: "0: inactive, 1: active",
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      updated_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "organization_tool",
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
};
