const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const Tools = sequelize.define(
    "tools",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      tool_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: "tool_name",
      },
      tool_logo: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      tool_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      tool_status: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: 1,
      },
    },
    {
      sequelize,
      tableName: "tools",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "tool_name",
          unique: true,
          using: "BTREE",
          fields: [{ name: "tool_name" }],
        },
      ],
    }
  );

  Tools.associate = (models) => {
    Tools.belongsTo(models.organization_tool, {
      foreignKey: "id",
      as: "organization_tool",
    });
    Tools.hasMany(models.modules, {
      foreignKey: "id",
      as: "modules",
    });
  };

  return Tools;
};
