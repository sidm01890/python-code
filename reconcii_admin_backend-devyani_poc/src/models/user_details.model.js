const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  let Users = sequelize.define(
    "user_details",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: "username",
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      raw_password: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mobile: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      level: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role_name: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_label: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      parent_username: {
        type: DataTypes.STRING(255),
        allowNull: true,
        references: {
          model: "user_details",
          key: "username",
        },
      },
      organization_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      group_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
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
      access_token: {
        type: DataTypes.STRING(2555),
        allowNull: true,
      },
      refresh_token: {
        type: DataTypes.STRING(2555),
        allowNull: true,
      },
      otp_attempts: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      otp_resend_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reset_otp: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },
      reset_otp_expires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "user_details",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "username",
          unique: true,
          using: "BTREE",
          fields: [{ name: "username" }],
        },
        {
          name: "FK_user_parent_username",
          using: "BTREE",
          fields: [{ name: "parent_username" }],
        },
        {
          name: "FK_user_orgnization_id",
          using: "BTREE",
          fields: [{ name: "organization_id" }],
        },
      ],
    }
  );

  Users.associate = (models) => {
    Users.belongsTo(models.groups, {
      foreignKey: "id",
      as: "groups",
    });
    Users.belongsTo(models.organization, {
      foreignKey: "id",
      as: "organization",
    });
  };

  return Users;
};
