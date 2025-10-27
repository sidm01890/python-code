const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ZomatoReceivablesVsReceipts = sequelize.define(
    "zomato_receivables_vs_receipts",
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      order_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      store_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      utr_number: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      utr_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      total_orders: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      final_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      deposit_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      bank: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      account_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: true,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: true,
      },
    },
    {
      tableName: "zomato_receivables_vs_receipts",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "ix_zomato_receivables_vs_receipts_id",
          fields: ["id"],
        },
        {
          name: "ix_zomato_receivables_vs_receipts_order_date",
          fields: ["order_date"],
        },
        {
          name: "ix_zomato_receivables_vs_receipts_utr_number",
          fields: ["utr_number"],
        },
      ],
    }
  );

  return ZomatoReceivablesVsReceipts;
};
