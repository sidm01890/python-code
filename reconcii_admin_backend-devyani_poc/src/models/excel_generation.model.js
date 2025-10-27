const { DataTypes } = require("sequelize");
const db = require("../config/db.config");

module.exports = (sequelize) => {
  const ExcelGeneration = sequelize.define(
    "excel_generation",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      store_code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
        defaultValue: "pending",
      },
      progress: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      message: {
        type: DataTypes.TEXT,
      },
      filename: {
        type: DataTypes.TEXT,
      },
      error: {
        type: DataTypes.TEXT,
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
      tableName: "excel_generations",
    }
  );
  return ExcelGeneration;
};
