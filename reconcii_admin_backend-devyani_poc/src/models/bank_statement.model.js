const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const BankStatement = sequelize.define(
    "bank_statement",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      bank: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      account_no: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      particulars: {
        type: DataTypes.STRING(1000),
        allowNull: true,
      },
      utr: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      deposit_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {
      tableName: "bank_statement",
      timestamps: false, // Since the original table doesn't have created_at and updated_at
      charset: "utf8mb4",
      collate: "utf8mb4_0900_ai_ci",
    }
  );

  return BankStatement;
};
