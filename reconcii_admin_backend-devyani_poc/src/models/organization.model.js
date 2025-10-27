const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const Organization = sequelize.define(
    "organization",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      organization_unit_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: "organization_unit_name",
      },
      organization_full_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      domain_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      logo_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 1,
        comment: "0: inactive, 1: active",
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      updated_by: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      created_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      sequelize,
      tableName: "organization",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "organization_unit_name",
          unique: true,
          using: "BTREE",
          fields: [{ name: "organization_unit_name" }],
        },
      ],
    }
  );

  Organization.associate = (models) => {
    Organization.hasMany(models.organization_tool, {
      foreignKey: "id",
      as: "organization_tool",
    });
  };

  return Organization;
};
