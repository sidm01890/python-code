const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UploadLogs = sequelize.define(
    "upload_logs",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      filename: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      filepath: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      filesize: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      filetype: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      upload_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "Type of upload: orders, transactions, reconciliation, etc.",
      },
      status: {
        type: DataTypes.ENUM("uploaded", "processing", "completed", "failed"),
        defaultValue: "uploaded",
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processed_data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Stores processed data and summary information",
      },
      error_details: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Detailed error information if processing failed",
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      tableName: "upload_logs",
      indexes: [
        {
          fields: ["status"],
        },
        {
          fields: ["upload_type"],
        },
        {
          fields: ["created_at"],
        },
      ],
    }
  );

  return UploadLogs;
};
