const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('user_details_history', {
    id: {
      autoIncrement: true,
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    raw_password: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    mobile: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    level: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    role_name: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_label: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    parent_username: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    orgnization_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    updated_by: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    created_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updated_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    access_token: {
      type: DataTypes.STRING(2555),
      allowNull: true
    },
    refresh_token: {
      type: DataTypes.STRING(2555),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'user_details_history',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
};
