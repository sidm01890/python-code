module.exports = (sequelize, Sequelize) => {
  const CustomisedDbFields = sequelize.define(
    "customised_db_fields",
    {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      db_column_name: {
        type: Sequelize.STRING(90),
        allowNull: true,
      },
      client_name: {
        type: Sequelize.STRING(90),
        allowNull: true,
      },
      data_source: {
        type: Sequelize.STRING(90),
        allowNull: true,
      },
      excel_column_name: {
        type: Sequelize.STRING(90),
        allowNull: true,
      },
      tender_name: {
        type: Sequelize.STRING(90),
        allowNull: true,
      },
      table_name: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      created_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updated_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
    },
    {
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "updated_date",
      tableName: "customised_db_fields",
    }
  );

  return CustomisedDbFields;
};
