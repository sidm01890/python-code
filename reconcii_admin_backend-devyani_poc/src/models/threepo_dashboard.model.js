module.exports = (sequelize, Sequelize) => {
  const ThreepoDashboard = sequelize.define(
    "threepo_dashboard",
    {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      bank: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      booked: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      business_date: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      delta_promo: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      payment_type: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      pos_charges: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      pos_commission: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      pos_discounts: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      pos_freebies: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      pos_receivables: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      pos_sales: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      pos_vs_three_po: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      promo: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      receivables_vs_receipts: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      reconciled: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      store_code: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      tender_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      three_po_charges: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      three_po_commission: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      three_po_discounts: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      three_po_freebies: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      three_po_receivables: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      three_po_sales: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      un_reconciled: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
    },
    {
      tableName: "threepo_dashboard",
      timestamps: false,
      charset: "utf8mb4",
      collate: "utf8mb4_0900_ai_ci",
    }
  );

  return ThreepoDashboard;
};
