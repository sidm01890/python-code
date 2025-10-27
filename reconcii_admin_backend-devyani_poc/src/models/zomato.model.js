const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Zomato = sequelize.define(
    "zomato",
    {
      uid: {
        type: DataTypes.STRING(625),
        primaryKey: true,
        allowNull: false,
      },
      res_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      order_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      order_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      customer_compensation: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      pro_discount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      commission_rate: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      pg_applied_on: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      zvd: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      tcs_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      rejection_penalty_charge: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      user_credits_charge: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      promo_recovery_adj: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      icecream_handling: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      icecream_deductions: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      order_support_cost: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      pro_discount_passthrough: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      mvd: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      delivery_charge: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      bill_subtotal: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      commission_value: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      tax_rate: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      taxes_zomato_fee: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      credit_note_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      tds_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      pgcharge: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      logistics_charge: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      mdiscount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      customer_discount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      cancellation_refund: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      store_code: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      sap_code: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      store_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      city_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      city_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      res_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      payout_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(100),
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
      service_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      total_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      net_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      final_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      payment_method: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      total_voucher: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      promo_code: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      source_tax: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      tax_paid_by_customer: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      charged_by_zomato_agt_rejected_orders: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      percent: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      pg_chgs_percent: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      lg: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      ls: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      merchant_delivery_charge: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      merchant_pack_charge: {
        type: DataTypes.FLOAT,
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
      tableName: "zomato",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "ix_zomato_uid",
          fields: ["uid"],
        },
      ],
    }
  );

  // Define association with zomato_mappings
  Zomato.associate = function (models) {
    Zomato.belongsTo(models.zomato_mappings, {
      foreignKey: "res_id",
      targetKey: "zomato_store_code",
    });

    // Add association with zomato_vs_pos_summary
    Zomato.hasOne(models.zomato_vs_pos_summary, {
      foreignKey: "zomato_order_id",
      sourceKey: "order_id",
    });
  };

  return Zomato;
};
