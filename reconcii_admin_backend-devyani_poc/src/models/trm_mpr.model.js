const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TrmMpr = sequelize.define(
    "trm_mpr",
    {
      uid: {
        type: DataTypes.STRING(625),
        primaryKey: true,
        allowNull: false,
      },
      zone: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      store_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      pos_terminal: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      hardware_model: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      hardware_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      acquirer: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      terminal_id_tid: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      merchant_id_mid: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      batch_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      payment_mode: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      customer_payment_mode_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      customer_card_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      card_issuer: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      card_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      card_network: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      card_colour: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      invoice_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      approval_code: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      transaction_type_detail: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      tip_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      transaction_date: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      batch_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      txn_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      settlement_date: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      bill_invoice_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      rrn: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      is_emi_txn: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      emi_months: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_contactless: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      contactless_mode: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      cloud_ref_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      card_pan_check_sale_complete: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      route_preauth_other_acquirer: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      billing_transaction_id: {
        type: DataTypes.STRING(255),
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
      tableName: "trm_mpr",
      timestamps: false, // Since we're handling timestamps manually
      indexes: [
        {
          name: "ix_trm_mpr_billing_transaction_id",
          fields: ["billing_transaction_id"],
        },
        {
          name: "ix_trm_mpr_uid",
          fields: ["uid"],
        },
        {
          name: "ix_trm_mpr_transaction_id",
          fields: ["transaction_id"],
        },
      ],
    }
  );

  return TrmMpr;
};
