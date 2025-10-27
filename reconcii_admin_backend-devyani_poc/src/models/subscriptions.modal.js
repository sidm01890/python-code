const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "subscriptions",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tool_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      subscription_key: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: "subscription_key",
      },
    },
    {
      sequelize,
      tableName: "subscriptions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "id",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "subscription_key",
          unique: true,
          using: "BTREE",
          fields: [{ name: "subscription_key" }],
        },
      ],
    }
  );
};
