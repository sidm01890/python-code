const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Orders = sequelize.define(
    "orders",
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      original_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      business_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      store_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      online_order_taker: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      payment: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      bill_number: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      bill_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      bill_user: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      channel: {
        type: DataTypes.STRING(125),
        allowNull: true,
      },
      settlement_mode: {
        type: DataTypes.STRING(125),
        allowNull: true,
      },
      subtotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      discount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      net_sale: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      gst_at_5_percent: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      gst_ecom_at_5_percent: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      packaging_charge_cart_swiggy: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      packaging_charge: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      gross_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
      },
      mode_name: {
        type: DataTypes.STRING(125),
        allowNull: true,
      },
      transaction_number: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING(125),
        allowNull: true,
      },
      instance_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      restaurant_packaging_charges: {
        type: DataTypes.DECIMAL(15, 2),
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
      tableName: "orders",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "ix_orders_id",
          fields: ["id"],
        },
      ],
    }
  );

  return Orders;
};
