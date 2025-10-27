const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Trm = sequelize.define(
    "trm",
    {
      uid: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
        unique: true,
      },
      zone: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      store_name: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      pos: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      hardware_model: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      hardware_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      acquirer: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      tid: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      mid: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      batch_no: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      payment_mode: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      customer_payment_mode_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      card_issuer: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      card_type: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      card_network: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      card_colour: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      transaction_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      invoice: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      approval_code: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      amount: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      tip_amount: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      date: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      batch_status: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      txn_status: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      settlement_date: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      bill_invoice: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      rrn: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      emi_txn: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      emi_month: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      contactless: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      contactless_mode: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      cloud_ref_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      card_pan_check_for_sale_complete: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      route_preauth_to_other_acquirer: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      billing_transaction_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      store_code: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
    },
    {
      tableName: "trm",
      timestamps: false, // Since the table doesn't have created_at/updated_at columns
      indexes: [
        {
          fields: ["transaction_id"],
        },
        {
          fields: ["store_code"],
        },
        {
          fields: ["date"],
        },
        {
          fields: ["batch_no"],
        },
        {
          fields: ["tid"],
        },
        {
          fields: ["mid"],
        },
        {
          fields: ["approval_code"],
        },
        {
          fields: ["rrn"],
        },
        {
          fields: ["billing_transaction_id"],
        },
      ],
    }
  );

  return Trm;
};
