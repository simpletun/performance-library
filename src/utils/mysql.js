
import { createPool, format } from 'mysql';
import { logger } from './logger';

const isSelect = /^select/i;
const largeWhitespace = /[\n\t]+/g;

const props = new WeakMap();

export class MysqlPool {
	constructor({ master, readCluster }) {
		const masterPool = makePool(master);
		const readClusterPool = readCluster ? makePool(readCluster) : masterPool;

		props.set(this, {
			masterPool,
			readClusterPool,
			masterUrl: buildUrl(master),
			readClusterUrl: readCluster && buildUrl(readCluster)
		});
	}

	getWriteConnection() {
		return getConnection(props.get(this).masterPool);
	}

	getReadConnection() {
		return getConnection(props.get(this).readClusterPool);
	}

	endPool() {
		props.get(this).readClusterPool.end();
		props.get(this).masterPool.end();
	}

	query(queryTemplate, params, processor) {
		const formattedQuery = format(queryTemplate, params || [ ]).trim();

		const getConnection = isSelect.test(formattedQuery)
			? this.getReadConnection()
			: this.getWriteConnection();

		return new Promise((resolve, reject) => {
			const onError = (error) => {
				if (error.code === 'ER_LOCK_WAIT_TIMEOUT' || error.code === 'ER_LOCK_DEADLOCK') {
					logger.warn(`MySQL Lock Error ${error.code} encountered; retrying query...`);

					// Retry the query in the case of database locks
					return retryDelay(() => this.query(queryTemplate, params, processor).then(resolve, reject));
				}

				reject(error);
			};

			getConnection
				.then((connection) => {
					if (processor) {
						const queryHandler = connection.query(formattedQuery);

						queryHandler.on('error', onError);
						queryHandler.on('result', processor);
						queryHandler.on('end', (result) => {
							connection.release();
							resolve(result);
						});
					}

					else {
						connection.query(formattedQuery, (error, results, fields) => {
							connection.release();

							if (error) {
								return onError(error);
							}

							resolve({ results, fields });
						});
					}
				})
				.catch((err) => {
					logger.error(`Getting connection error ---> ${err}`);
				});
		});
	}

	healthcheck() {
		const { masterUrl, masterPool, readClusterUrl, readClusterPool } = props.get(this);

		const pools = [
			{ url: masterUrl, pool: masterPool }
		];

		if (readClusterUrl) {
			pools.push({ url: readClusterUrl, pool: readClusterPool });
		}

		return Promise.all(
			pools.map(({ url, pool }) => healthcheck(url, pool))
		);
	}
};

// Do lock reties with a random delay between 0 and 100 milliseconds
const retryDelay = (func) => {
	setTimeout(func, Math.floor(Math.random() * 100));
};

const getConnection = (pool) => {
	return new Promise((resolve, reject) => {
		pool.getConnection((error, connection) => {
			if (error) {
				return reject(error);
			}

			resolve(connection);
		});
	});
};

const heldPoolTimers = new WeakMap();

const onConnection = (connection) => {
	const thread = connection.threadId;

	connection.on('error', (error) => {
		logger.error('Unhandled MySQL Error', { thread, code: error.code, error: error.sqlMessage, fatal: error.fatal });

		if (error.fatal) {
			onRelease(connection);
			connection.destroy();
		}
	});

	connection.on('enqueue', (query) => {
		if (query.sql) {
			const start = Date.now();
			const formattedQuery = truncate(query.sql.replace(largeWhitespace, ' '), 500);

			logger.debug('Start MySQL Query', { thread, query: formattedQuery });

			query.on('end', () => {
				const duration = `${Date.now() - start}ms`;

				logger.verbose('Completed MySQL Query', { thread, query: formattedQuery, duration });
			});
		}
	});
};

const onAcquire = (connection) => {
	const onHeldTooLong = () => logger.warn(`MySQL connection ${connection.threadId} held for over a minute, this might be an unreleased connection`);

	heldPoolTimers.set(connection, setTimeout(onHeldTooLong, 60000));
};

const onRelease = (connection) => {
	const timer = heldPoolTimers.get(connection);

	if (timer) {
		clearTimeout(timer);
		heldPoolTimers.delete(connection);
	}
};

const makePool = (config) => {
	const url = buildUrl(config);
	const pool = createPool(config);

	pool.on('connection', onConnection);
	pool.on('acquire', onAcquire);
	pool.on('release', onRelease);
	pool.on('enqueue', () => {
		logger.warn('No remaining connections available in the pool, queueing up request', { url });
	});

	return pool;
};

const buildUrl = (config) => {
	return `mysql://${config.host}:${config.port}/${config.database}`;
};

const healthcheck = (url, pool) => {
	const status = { url };
	const startTime = Date.now();

	return testConnection(url, pool)
		.then(
			() => {
				status.available = true;
			},
			(error) => {
				status.available = false;
				status.info = error instanceof Error ? error.message : error;
			}
		)
		.then(() => {
			const duration = Date.now() - startTime;

			status.duration = `${duration}ms`;
			if (duration > 100) {
				status.warning = 'Connection slower than 100ms';
			}

			return status;
		});
};

const testConnection = (url, pool) => {
	return new Promise((resolve, reject) => {
		pool.getConnection((err, connection) => {
			if (err) {
				return reject(err);
			}

			connection.query('select version()', (error, result) => {
				connection.release();

				if (error) {
					return reject(error);
				}

				resolve(result);
			});
		});
	});
};

const truncate = (string, length) => {
	if (string.length > length) {
		return string.slice(0, length) + '.....';
	}

	return string;
};
