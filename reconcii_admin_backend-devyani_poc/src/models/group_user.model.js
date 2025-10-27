const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('group_user', {
    group_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'groupss',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'user_details',
        key: 'id'
      }
    }
  }, {
    sequelize,
    tableName: 'group_user',
    timestamps: false,
    indexes: [
      {
        name: "FK_gu_group_id",
        using: "BTREE",
        fields: [
          { name: "group_id" },
        ]
      },
      {
        name: "FK_gu_user_id",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
    ]
  });
};
