const postgres = require("postgres");

const connectionInfo = {
	host: "localhost",
	port: 5432,
	database: "yugiohscraper",
	username: "postgres",
	password: "yugioh",
};
const sql = postgres(connectionInfo);

module.exports = sql;
