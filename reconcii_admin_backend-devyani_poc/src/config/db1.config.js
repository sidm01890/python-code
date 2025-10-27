const bercosSsoConfig = {
  HOST: "coreco-mysql.cpzxmgfkrh6g.ap-south-1.rds.amazonaws.com",
  USER: "admin",
  PASSWORD: "One4the$#",
  DB: "devyani_sso",
  // HOST: "localhost",
  // USER: "root",
  // PASSWORD: "12345678",
  // DB: "bercos_sso",
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
  logging: console.log, // Set to false to disable logging, or provide a custom logger function
  dialectOptions: {
    // Additional MySQL-specific options can be added here
  },
  define: {
    // Global model definition options
    timestamps: true, // Set to false if you don't want Sequelize to auto-manage timestamps
  },
};

const bercosConfig = {
  HOST: "coreco-mysql.cpzxmgfkrh6g.ap-south-1.rds.amazonaws.com",
  USER: "admin",
  PASSWORD: "One4the$#",
  DB: "devyani",
  // HOST: "localhost",
  // USER: "root",
  // PASSWORD: "12345678",
  // DB: "bercos_sso",
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
  logging: console.log, // Set to false to disable logging, or provide a custom logger function
  dialectOptions: {
    // Additional MySQL-specific options can be added here
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
