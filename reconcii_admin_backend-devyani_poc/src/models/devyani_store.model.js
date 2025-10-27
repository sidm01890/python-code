const { DataTypes } = require("sequelize");
const db = require("../config/db.config");

module.exports = (sequelize) => {
  const DevyaniStore = sequelize.define(
    "devyani_store",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      store_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      sap_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      store_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      city_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      tableName: "devyani_stores",
    }
  );

  return DevyaniStore;
};
