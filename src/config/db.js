
require("dotenv").config();

const { Pool } = require("pg");

const emProducao = process.env.NODE_ENV === "production";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  ssl: emProducao
    ? {
        rejectUnauthorized: true
      }
    : false,

  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (erro) => {
  console.error(
    "Erro na conexão PostgreSQL:",
    erro.message
  );
});

module.exports = pool;
