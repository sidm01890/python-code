const bercosSsoConfig = {
  HOST: "localhost",
  USER: "root",
  PASSWORD: "NewStrongPassword123!",
  // HOST: "coreco-mysql.cpzxmgfkrh6g.ap-south-1.rds.amazonaws.com",
  // USER: "admin",
  // PASSWORD: "One4the$#",
  DB: "bercos_sso",
  dialect: "mysql",
  PORT: 3306,
  // Defining DB connection timeout criteria
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  // Sequelize logging option
  logging: false, // Disabled query logging
  dialectOptions: {
    // Additional MySQL-specific options can be added here
  },
  define: {
    // Global model definition options
    timestamps: true, // Set to false if you don't want Sequelize to auto-manage timestamps
  },
};

const bercosConfig = {
  HOST: "localhost",
  USER: "root",
  PASSWORD: "NewStrongPassword123!",
  // HOST: "coreco-mysql.cpzxmgfkrh6g.ap-south-1.rds.amazonaws.com",
  // USER: "admin",
  // PASSWORD: "One4the$#",
  DB: "devyani",
  dialect: "mysql",
  PORT: 3306,
  // Defining DB connection timeout criteria
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
  // Sequelize logging option
  logging: false, // Disabled query logging
  dialectOptions: {
    connectTimeout: 60000,
    // MySQL specific timeout settings
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
  },
  define: {
    // Global model definition options
    timestamps: true, // Set to false if you don't want Sequelize to auto-manage timestamps
  },
};

module.exports = {
  bercosSso: bercosSsoConfig,
  bercos: bercosConfig,
};
