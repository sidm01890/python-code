module.exports = (sequelize, Sequelize) => {
  const RecoLogics = sequelize.define(
    "reco_logics",
    {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      created_date: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      updated_date: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      recologic: {
        type: Sequelize.TEXT("medium"),
        allowNull: true,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      tender: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      createdby: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      effectivefrom: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      effectiveto: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      effectivetype: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "reco_logics",
      timestamps: false, // Since we're managing timestamps manually
      charset: "utf8mb4",
      collate: "utf8mb4_0900_ai_ci",
    }
  );

  return RecoLogics;
};
