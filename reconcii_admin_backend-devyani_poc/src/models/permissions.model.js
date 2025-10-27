const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const Permissions = sequelize.define(
    "permissions",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      permission_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      permission_code: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: "permission_code",
      },
      module_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "modules",
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
    },
    {
      sequelize,
      tableName: "permissions",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "permission_code",
          unique: true,
          using: "BTREE",
          fields: [{ name: "permission_code" }],
        },
        {
          name: "module_id",
          using: "BTREE",
          fields: [{ name: "module_id" }],
        },
        {
          name: "tool_id",
          using: "BTREE",
          fields: [{ name: "tool_id" }],
        },
      ],
    }
  );

  Permissions.associate = (models) => {
    Permissions.belongsTo(models.tools, {
      foreignKey: "id",
      as: "tools",
    });
    Permissions.belongsTo(models.modules, {
      foreignKey: "id",
      as: "modules",
    });
  };

  return Permissions;
};
