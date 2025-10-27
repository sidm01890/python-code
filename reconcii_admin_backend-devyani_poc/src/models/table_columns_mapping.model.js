const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TableColumnsMapping = sequelize.define(
    "table_columns_mapping",
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      customer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      tender_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      db_column_name: {
        type: DataTypes.STRING(90),
        allowNull: true,
      },
      data_source: {
        type: DataTypes.STRING(90),
        allowNull: true,
      },
      excel_column_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      created_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updated_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      client_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "table_columns_mapping",
      timestamps: false, // Since we're handling timestamps manually
      indexes: [
        {
          name: "id",
          unique: true,
          fields: ["id"],
        },
      ],
    }
  );

  return TableColumnsMapping;
};
