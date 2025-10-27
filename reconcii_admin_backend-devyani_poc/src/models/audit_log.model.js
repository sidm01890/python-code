const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const AuditLog = sequelize.define(
    "audit_log",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(45),
        allowNull: false,
      },
      user_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      system_ip: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      role: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      action_details: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
      request: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      response: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "audit_log",
      timestamps: false,
      createdAt: "created_at",
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
      ],
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.user_details, {
      foreignKey: "id",
      as: "user_details",
    });
  };

  return AuditLog;
};
