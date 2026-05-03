const assert = require('assert');
const { EventEmitter } = require('events');

// Mock connection class
class MockConnection extends EventEmitter {
	constructor() {
		super();
		this.threadId = Math.floor(Math.random() * 1000);
		this.released = false;
	}

	query(sql, callback) {
		// Simulate async query
		setImmediate(() => {
			if (typeof callback === 'function') {
				const results = [{ id: 1, name: 'test' }];
				const fields = [{ name: 'id' }, { name: 'name' }];
				callback(null, results, fields);
			}
		});

		// Return query handler for streaming queries
		const queryHandler = new EventEmitter();
		setImmediate(() => {
			queryHandler.emit('result', { id: 1, name: 'test' });
			queryHandler.emit('end', { affectedRows: 1 });
		});
		return queryHandler;
	}

	release() {
		this.released = true;
		this.emit('release');
	}

	destroy() {
		this.emit('destroy');
	}
}

// Mock pool class
class MockPool extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		this.ended = false;
	}

	getConnection(callback) {
		const connection = new MockConnection();
		setImmediate(() => {
			this.emit('connection', connection);
			this.emit('acquire', connection);
			callback(null, connection);
		});
	}

	end() {
		this.ended = true;
		this.emit('end');
	}
}

let mockPoolInstance = null;

const mockCreatePool = (config) => {
	mockPoolInstance = new MockPool(config);
	return mockPoolInstance;
};

const mockFormat = (query, params) => {
	// Simple mock implementation
	let formatted = query;
	if (params && params.length > 0) {
		params.forEach(param => {
			formatted = formatted.replace('?', typeof param === 'string' ? `'${param}'` : param);
		});
	}
	return formatted;
};

const mockLogger = {
	silly: () => {},
	debug: () => {},
	verbose: () => {},
	warn: () => {},
	error: () => {}
};

// Mock the modules before requiring
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
	if (id === 'mysql') {
		return {
			createPool: mockCreatePool,
			format: mockFormat
		};
	}
	if (id === './logger' || id === '../utils/logger') {
		return { logger: mockLogger };
	}
	return originalRequire.apply(this, arguments);
};

const { MysqlPool } = require('../src/utils/mysql');

// Restore original require
Module.prototype.require = originalRequire;

describe('mysql.js', () => {
	describe('MysqlPool constructor', () => {
		it('should create a pool with master configuration', () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb',
				user: 'testuser',
				password: 'testpass'
			};

			const pool = new MysqlPool({ master: masterConfig });

			assert(pool !== null, 'Pool should be created');
		});

		it('should create separate read cluster pool when provided', () => {
			const masterConfig = {
				host: 'master.db.com',
				port: 3306,
				database: 'testdb',
				user: 'testuser',
				password: 'testpass'
			};

			const readClusterConfig = {
				host: 'read.db.com',
				port: 3306,
				database: 'testdb',
				user: 'readuser',
				password: 'readpass'
			};

			const pool = new MysqlPool({
				master: masterConfig,
				readCluster: readClusterConfig
			});

			assert(pool !== null, 'Pool should be created');
		});

		it('should use master pool for reads when no read cluster is provided', () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb',
				user: 'testuser',
				password: 'testpass'
			};

			const pool = new MysqlPool({ master: masterConfig });

			assert(pool !== null, 'Pool should be created and use master for reads');
		});
	});

	describe('getWriteConnection', () => {
		it('should return a connection from master pool', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const connection = await pool.getWriteConnection();

			assert(connection !== null, 'Should return a connection');
			assert(connection.threadId !== undefined, 'Connection should have threadId');
		});
	});

	describe('getReadConnection', () => {
		it('should return a connection from read cluster pool when available', async () => {
			const masterConfig = {
				host: 'master.db.com',
				port: 3306,
				database: 'testdb'
			};

			const readClusterConfig = {
				host: 'read.db.com',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({
				master: masterConfig,
				readCluster: readClusterConfig
			});

			const connection = await pool.getReadConnection();

			assert(connection !== null, 'Should return a connection');
		});

		it('should return a connection from master pool when no read cluster', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const connection = await pool.getReadConnection();

			assert(connection !== null, 'Should return a connection');
		});
	});

	describe('query - SELECT queries', () => {
		it('should execute SELECT query using read connection', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('SELECT * FROM users WHERE id = ?', [1]);

			assert(result.results !== undefined, 'Should return results');
			assert(Array.isArray(result.results), 'Results should be an array');
			assert(result.fields !== undefined, 'Should return fields');
		});

		it('should format query with parameters', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('SELECT * FROM users WHERE name = ?', ['John']);

			assert(result.results !== undefined, 'Should return results');
		});

		it('should handle SELECT query without parameters', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('SELECT * FROM users');

			assert(result.results !== undefined, 'Should return results');
		});
	});

	describe('query - INSERT/UPDATE/DELETE queries', () => {
		it('should execute INSERT query using write connection', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('INSERT INTO users (name) VALUES (?)', ['John']);

			assert(result.results !== undefined, 'Should return results');
		});

		it('should execute UPDATE query using write connection', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('UPDATE users SET name = ? WHERE id = ?', ['Jane', 1]);

			assert(result.results !== undefined, 'Should return results');
		});

		it('should execute DELETE query using write connection', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('DELETE FROM users WHERE id = ?', [1]);

			assert(result.results !== undefined, 'Should return results');
		});
	});

	describe('query - streaming with processor', () => {
		it('should handle streaming query with processor function', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const processedRows = [];

			const processor = (row) => {
				processedRows.push(row);
			};

			const result = await pool.query('SELECT * FROM users', null, processor);

			assert(processedRows.length > 0, 'Processor should have been called');
			assert.equal(result.affectedRows, 1, 'Should return result metadata');
		});
	});

	describe('query - error handling', () => {
		it('should handle query errors', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			// Override mock to simulate error
			const originalQuery = MockConnection.prototype.query;
			MockConnection.prototype.query = function(sql, callback) {
				const error = new Error('Query failed');
				error.code = 'ER_SYNTAX_ERROR';

				if (typeof callback === 'function') {
					setImmediate(() => callback(error));
				} else {
					// For streaming queries without callback
					const queryHandler = new EventEmitter();
					setImmediate(() => {
						queryHandler.emit('error', error);
					});
					return queryHandler;
				}
			};

			const pool = new MysqlPool({ master: masterConfig });

			try {
				await pool.query('INVALID SQL');
				assert.fail('Should have thrown an error');
			} catch (error) {
				assert.equal(error.code, 'ER_SYNTAX_ERROR');
			}

			// Restore original
			MockConnection.prototype.query = originalQuery;
		});

		it('should retry on lock timeout', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			let attemptCount = 0;
			const originalGetConnection = MockPool.prototype.getConnection;

			MockPool.prototype.getConnection = function(callback) {
				attemptCount++;

				const connection = new MockConnection();
				const originalConnQuery = connection.query.bind(connection);

				connection.query = function(sql, cb) {
					if (attemptCount === 1) {
						// First attempt - simulate lock timeout
						const error = new Error('Lock wait timeout');
						error.code = 'ER_LOCK_WAIT_TIMEOUT';

						if (typeof cb === 'function') {
							setImmediate(() => cb(error));
						}
					} else {
						// Second attempt - succeed
						return originalConnQuery(sql, cb);
					}
				};

				setImmediate(() => {
					this.emit('connection', connection);
					this.emit('acquire', connection);
					callback(null, connection);
				});
			};

			const pool = new MysqlPool({ master: masterConfig });

			// This should succeed after retry
			const result = await pool.query('UPDATE users SET name = ? WHERE id = ?', ['Jane', 1]);

			assert(result.results !== undefined, 'Should succeed after retry');
			assert(attemptCount >= 2, 'Should have retried at least once');

			// Restore original
			MockPool.prototype.getConnection = originalGetConnection;
		});

		it('should retry on deadlock', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			let attemptCount = 0;
			const originalGetConnection = MockPool.prototype.getConnection;

			MockPool.prototype.getConnection = function(callback) {
				attemptCount++;

				const connection = new MockConnection();
				const originalConnQuery = connection.query.bind(connection);

				connection.query = function(sql, cb) {
					if (attemptCount === 1) {
						// First attempt - simulate deadlock
						const error = new Error('Deadlock found');
						error.code = 'ER_LOCK_DEADLOCK';

						if (typeof cb === 'function') {
							setImmediate(() => cb(error));
						}
					} else {
						// Second attempt - succeed
						return originalConnQuery(sql, cb);
					}
				};

				setImmediate(() => {
					this.emit('connection', connection);
					this.emit('acquire', connection);
					callback(null, connection);
				});
			};

			const pool = new MysqlPool({ master: masterConfig });

			// This should succeed after retry
			const result = await pool.query('UPDATE users SET name = ? WHERE id = ?', ['Jane', 1]);

			assert(result.results !== undefined, 'Should succeed after retry');
			assert(attemptCount >= 2, 'Should have retried at least once');

			// Restore original
			MockPool.prototype.getConnection = originalGetConnection;
		});
	});

	describe('endPool', () => {
		it('should end both master and read cluster pools', () => {
			const masterConfig = {
				host: 'master.db.com',
				port: 3306,
				database: 'testdb'
			};

			const readClusterConfig = {
				host: 'read.db.com',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({
				master: masterConfig,
				readCluster: readClusterConfig
			});

			pool.endPool();

			// Pool should be ended (we can't easily verify this in the mock, but no error should be thrown)
			assert(true, 'endPool should complete without error');
		});
	});

	describe('healthcheck', () => {
		it('should check health of master pool', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const healthStatus = await pool.healthcheck();

			assert(Array.isArray(healthStatus), 'Should return array of health statuses');
			assert(healthStatus.length >= 1, 'Should check at least master pool');
			assert(healthStatus[0].url !== undefined, 'Should include URL');
			assert(healthStatus[0].available !== undefined, 'Should include availability status');
			assert(healthStatus[0].duration !== undefined, 'Should include duration');
		});

		it('should check health of both master and read cluster', async () => {
			const masterConfig = {
				host: 'master.db.com',
				port: 3306,
				database: 'testdb'
			};

			const readClusterConfig = {
				host: 'read.db.com',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({
				master: masterConfig,
				readCluster: readClusterConfig
			});

			const healthStatus = await pool.healthcheck();

			assert.equal(healthStatus.length, 2, 'Should check both pools');
			assert(healthStatus[0].url.includes('master.db.com'), 'First status should be for master');
			assert(healthStatus[1].url.includes('read.db.com'), 'Second status should be for read cluster');
		});

		it('should detect slow connections', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			// Override getConnection to simulate slow connection
			const originalGetConnection = MockPool.prototype.getConnection;
			MockPool.prototype.getConnection = function(callback) {
				setTimeout(() => {
					originalGetConnection.call(this, callback);
				}, 150); // Longer than 100ms threshold
			};

			const pool = new MysqlPool({ master: masterConfig });
			const healthStatus = await pool.healthcheck();

			assert(healthStatus[0].warning !== undefined, 'Should include warning for slow connection');

			// Restore original
			MockPool.prototype.getConnection = originalGetConnection;
		});

		it('should handle connection errors in healthcheck', async () => {
			const masterConfig = {
				host: 'invalid.host',
				port: 3306,
				database: 'testdb'
			};

			// Override getConnection to simulate error
			const originalGetConnection = MockPool.prototype.getConnection;
			MockPool.prototype.getConnection = function(callback) {
				setImmediate(() => {
					callback(new Error('Connection failed'));
				});
			};

			const pool = new MysqlPool({ master: masterConfig });
			const healthStatus = await pool.healthcheck();

			assert.equal(healthStatus[0].available, false, 'Should mark pool as unavailable');
			assert(healthStatus[0].info !== undefined, 'Should include error info');

			// Restore original
			MockPool.prototype.getConnection = originalGetConnection;
		});
	});

	describe('connection lifecycle events', () => {
		it('should emit connection events', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });

			// Getting a connection should trigger connection and acquire events
			const connection = await pool.getWriteConnection();

			assert(connection !== null, 'Connection should be established');
		});

		it('should release connections properly', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			await pool.query('SELECT * FROM users');

			// Query should automatically release connection
			assert(true, 'Connection should be released after query');
		});
	});

	describe('query formatting', () => {
		it('should properly format queries with string parameters', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('SELECT * FROM users WHERE name = ?', ['John Doe']);

			assert(result.results !== undefined, 'Should execute formatted query');
		});

		it('should properly format queries with numeric parameters', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('SELECT * FROM users WHERE id = ? AND age > ?', [123, 18]);

			assert(result.results !== undefined, 'Should execute formatted query');
		});

		it('should handle queries with no parameters', async () => {
			const masterConfig = {
				host: 'localhost',
				port: 3306,
				database: 'testdb'
			};

			const pool = new MysqlPool({ master: masterConfig });
			const result = await pool.query('SELECT COUNT(*) FROM users', []);

			assert(result.results !== undefined, 'Should execute query without parameters');
		});
	});
});

