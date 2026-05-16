/*
Data provider for mysql requests.  Creates connection pool for db that must be defined in
config file.
*/
import { logger } from '../utils/logger.js';
import { config, shutdown, onMessage, sendMessage } from '../worker.js';
import { MysqlPool } from '../utils/mysql.js';

const pool = new MysqlPool({master: config.dbConnection});

onMessage('stop', async () => {
	pool.endPool();
	shutdown();
});

// When a worker asks for data, make the query and send the results back in a response message.
onMessage('dbQuery', async (/** @type {{ query: string, responseType: string, queryId: string, from: string }} */ queryRequestObj) => {
	logger.silly(`Provider - got dbquery request with query --> ${queryRequestObj.query}`);

	const results = await makeRequest(queryRequestObj.query);

	const response = {
		type: queryRequestObj.responseType,
		results: results,
		queryId: queryRequestObj.queryId
	};

	sendMessage('direct', {
		message: response,
		to: queryRequestObj.from
	});
});

/** @param {string} queryString */
const makeRequest = async (queryString) => {

	let { results } = await pool.query(queryString);

	return results;
};
