const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const TenderColumnMapping = sequelize.define(
    "tender_column_mapping",
    {
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      excel_column_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "excel_tender_columns",
          key: "id",
        },
      },
      db_column_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "db_tender_columns",
          key: "id",
        },
      },
    },
    {
      sequelize,
      tableName: "tender_column_mapping",
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "id" }],
        },
        {
          name: "excel_column_id",
          using: "BTREE",
          fields: [{ name: "excel_column_id" }],
        },
        {
          name: "db_column_id",
          using: "BTREE",
          fields: [{ name: "db_column_id" }],
        },
      ],
    }
  );

  TenderColumnMapping.associate = (models) => {
    TenderColumnMapping.belongsTo(models.excel_tender_columns, {
      foreignKey: "id",
      as: "excel_tender_columns",
    });
    TenderColumnMapping.belongsTo(models.db_tender_columns, {
      foreignKey: "id",
      as: "db_tender_columns",
    });
  };

  return TenderColumnMapping;
};
