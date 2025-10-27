const Sequelize = require("sequelize");
const { organization } = require(".");
module.exports = function (sequelize, DataTypes) {
  const Group = sequelize.define(
    "groups",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      group_name: {
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
      organization_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "groups",
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

  Group.associate = (models) => {
    Group.belongsTo(models.tools, {
      foreignKey: "id",
      as: "tools",
    });
    Group.hasMany(models.group_module_mapping, {
      foreignKey: "id",
      as: "group_module_mapping",
    });
    Group.hasMany(models.user_details, {
      foreignKey: "id",
      as: "users",
    });
  };

  return Group;
};
