const { DataTypes } = require("sequelize");
const db = require("../config/db.config");

module.exports = (sequelize) => {
  const DevyaniCity = sequelize.define(
    "devyani_city",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      city_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      city_name: {
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
      tableName: "devyani_cities",
    }
  );

  return DevyaniCity;
};
