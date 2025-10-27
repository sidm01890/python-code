module.exports = (sequelize, Sequelize) => {
  const ZomatoVsPosSummary = sequelize.define(
    "zomato_vs_pos_summary",
    {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      pos_order_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      zomato_order_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      order_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      store_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      // Net Amount
      pos_net_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_net_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_net_amount_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_net_amount_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // Tax Paid by Customer
      pos_tax_paid_by_customer: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_tax_paid_by_customer: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_tax_paid_by_customer_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_tax_paid_by_customer_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // Commission Value
      pos_commission_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_commission_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_commission_value_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_commission_value_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // PG Applied On
      pos_pg_applied_on: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_pg_applied_on: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_pg_applied_on_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_pg_applied_on_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // PG Charge
      pos_pg_charge: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_pg_charge: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_pg_charge_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_pg_charge_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // Taxes Zomato Fee
      pos_taxes_zomato_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_taxes_zomato_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_taxes_zomato_fee_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_taxes_zomato_fee_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // TDS Amount
      pos_tds_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_tds_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_tds_amount_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_tds_amount_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // Final Amount
      pos_final_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_final_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_final_amount_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      zomato_vs_pos_final_amount_delta: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // Calculated Zomato Values
      calculated_zomato_net_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_zomato_tax_paid_by_customer: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_zomato_commission_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_zomato_pg_applied_on: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_zomato_pg_charge: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_zomato_taxes_zomato_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_zomato_tds_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      calculated_zomato_final_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      // Additional Fields
      fixed_credit_note_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_pro_discount_passthrough: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_customer_discount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_rejection_penalty_charge: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_user_credits_charge: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_promo_recovery_adj: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_icecream_handling: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_icecream_deductions: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_order_support_cost: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      fixed_merchant_delivery_charge: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      reconciled_status: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      reconciled_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      unreconciled_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      pos_vs_zomato_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      zomato_vs_pos_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      order_status_zomato: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      order_status_pos: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "zomato_vs_pos_summary",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return ZomatoVsPosSummary;
};
