const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ZomatoPosVs3poData = sequelize.define(
    "zomato_pos_vs_3po_data",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      pos_order_id: {
        type: DataTypes.STRING,
      },
      zomato_order_id: {
        type: DataTypes.STRING,
      },
      order_date: {
        type: DataTypes.DATEONLY,
      },
      store_name: {
        type: DataTypes.STRING,
      },
      pos_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_net_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_tax_paid_by_customer_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_commission_value_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_pg_applied_on_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_pg_charge_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_taxes_zomato_fee_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_tds_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_final_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      reconciled_status: {
        type: DataTypes.STRING,
      },
      reconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      unreconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_reason: {
        type: DataTypes.STRING,
      },
      order_status_pos: {
        type: DataTypes.STRING,
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "zomato_pos_vs_3po_data",
      timestamps: false,
    }
  );

  const Zomato3poVsPosData = sequelize.define(
    "zomato_3po_vs_pos_data",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      zomato_order_id: {
        type: DataTypes.STRING,
      },
      pos_order_id: {
        type: DataTypes.STRING,
      },
      order_date: {
        type: DataTypes.DATEONLY,
      },
      store_name: {
        type: DataTypes.STRING,
      },
      zomato_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_net_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_tax_paid_by_customer_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_commission_value_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_pg_applied_on_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_pg_charge_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_taxes_zomato_fee_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_tds_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_final_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_credit_note_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_pro_discount_passthrough: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_customer_discount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_rejection_penalty_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_user_credits_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_promo_recovery_adj: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_icecream_handling: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_icecream_deductions: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_order_support_cost: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_merchant_delivery_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      reconciled_status: {
        type: DataTypes.STRING,
      },
      reconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      unreconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_reason: {
        type: DataTypes.STRING,
      },
      order_status_zomato: {
        type: DataTypes.STRING,
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "zomato_3po_vs_pos_data",
      timestamps: false,
    }
  );

  const Zomato3poVsPosRefundData = sequelize.define(
    "zomato_3po_vs_pos_refund_data",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      zomato_order_id: {
        type: DataTypes.STRING,
      },
      pos_order_id: {
        type: DataTypes.STRING,
      },
      order_date: {
        type: DataTypes.DATEONLY,
      },
      store_name: {
        type: DataTypes.STRING,
      },
      zomato_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_net_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_tax_paid_by_customer_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_commission_value_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_pg_applied_on_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_pg_charge_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_taxes_zomato_fee_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_tds_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_final_amount_delta: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_credit_note_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_pro_discount_passthrough: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_customer_discount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_rejection_penalty_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_user_credits_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_promo_recovery_adj: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_icecream_handling: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_icecream_deductions: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_order_support_cost: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_merchant_delivery_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      reconciled_status: {
        type: DataTypes.STRING,
      },
      reconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      unreconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_reason: {
        type: DataTypes.STRING,
      },
      order_status_zomato: {
        type: DataTypes.STRING,
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "zomato_3po_vs_pos_refund_data",
      timestamps: false,
    }
  );

  const OrdersNotInPosData = sequelize.define(
    "orders_not_in_pos_data",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      zomato_order_id: {
        type: DataTypes.STRING,
      },
      order_date: {
        type: DataTypes.DATEONLY,
      },
      store_name: {
        type: DataTypes.STRING,
      },
      zomato_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      calculated_zomato_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_credit_note_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_pro_discount_passthrough: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_customer_discount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_rejection_penalty_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_user_credits_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_promo_recovery_adj: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_icecream_handling: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_icecream_deductions: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_order_support_cost: {
        type: DataTypes.DECIMAL(15, 2),
      },
      fixed_merchant_delivery_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      reconciled_status: {
        type: DataTypes.STRING,
      },
      reconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      unreconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      zomato_vs_pos_reason: {
        type: DataTypes.STRING,
      },
      order_status_zomato: {
        type: DataTypes.STRING,
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "orders_not_in_pos_data",
      timestamps: false,
    }
  );

  const OrdersNotIn3poData = sequelize.define(
    "orders_not_in_3po_data",
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      pos_order_id: {
        type: DataTypes.STRING,
      },
      order_date: {
        type: DataTypes.DATEONLY,
      },
      store_name: {
        type: DataTypes.STRING,
      },
      pos_net_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tax_paid_by_customer: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_commission_value: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_applied_on: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_pg_charge: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_taxes_zomato_fee: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_tds_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_final_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      reconciled_status: {
        type: DataTypes.STRING,
      },
      reconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      unreconciled_amount: {
        type: DataTypes.DECIMAL(15, 2),
      },
      pos_vs_zomato_reason: {
        type: DataTypes.STRING,
      },
      order_status_pos: {
        type: DataTypes.STRING,
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "orders_not_in_3po_data",
      timestamps: false,
    }
  );

  return {
    ZomatoPosVs3poData,
    Zomato3poVsPosData,
    Zomato3poVsPosRefundData,
    OrdersNotInPosData,
    OrdersNotIn3poData,
  };
};
