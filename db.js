require("dotenv").config();
const postgres = require("postgres");
// https://www.npmjs.com/package/postgres
const connectionInfo = {
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	database: process.env.DB_NAME,
	username: process.env.DB_USERNAME,
	password: process.env.DB_PASS,
};
const sql = postgres(connectionInfo);

module.exports = sql;

const testSelect = async () => {
	const data = await sql`select name from packs`;
	console.log(data.length);
	await sql.end();
};

testSelect();
