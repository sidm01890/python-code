const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('user_role', {
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'user_details',
        key: 'id'
      }
    },
    role_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'role',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'user_role',
    timestamps: false,
    indexes: [
      {
        name: "FK_user_role_id",
        using: "BTREE",
        fields: [
          { name: "role_id" },
        ]
      },
      {
        name: "FK_user_user_id",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
    ]
  });
};
