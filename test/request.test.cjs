// @ts-nocheck
const assert = require('assert');
const { EventEmitter } = require('events');

// Mock the follow-redirects module
const mockHttp = {
	request: () => {}
};
const mockHttps = {
	request: () => {}
};

// Mock logger
const mockLogger = {
	debug: () => {},
	silly: () => {},
	warn: () => {}
};

let request;
before(async () => {
	const { default: esmock } = await import('esmock');
	({ request } = await esmock('../src/utils/request.js', {
		'follow-redirects': { default: { http: mockHttp, https: mockHttps } },
		'../src/utils/logger.js': { logger: mockLogger },
	}));
});

describe('request.js', () => {
	let mockReq;
	let mockRes;
	let mockSocket;

	beforeEach(() => {
		// Create mock socket
		mockSocket = new EventEmitter();
		mockSocket.bytesRead = 1024;
		mockSocket.bytesWritten = 512;

		// Create mock request object
		mockReq = new EventEmitter();
		mockReq.write = () => {};
		mockReq.end = () => {};
		mockReq.socket = mockSocket;
		mockReq.useChunkedEncodingByDefault = false;

		// Create mock response object
		mockRes = new EventEmitter();
		mockRes.statusCode = 200;
	});

	describe('successful GET request', () => {
		it('should successfully make a GET request and return response data', async () => {
			const testData = {
				method: 'GET',
				hostname: 'example.com',
				path: '/api/test',
				ssl: false
			};

			mockHttp.request = (options, callback) => {
				// Verify options are set correctly
				assert.equal(options.hostname, 'example.com');
				assert.equal(options.method, 'GET');
				assert.equal(options.path, '/api/test');
				assert.equal(options.port, 80);

				// Emit socket event first
				setImmediate(() => {
					mockReq.emit('socket');
					// Then emit connect on socket
					setImmediate(() => {
						mockSocket.emit('connect');
						// Then call response callback
						setImmediate(() => {
							callback(mockRes);
							// Simulate response data
							mockRes.emit('data', 'test');
							mockRes.emit('data', ' response');
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			const result = await request(testData);

			assert(result.success, 'Request should be successful');
			assert.equal(result.status, 200);
			assert.equal(result.body, 'test response');
			assert.equal(result.bytes, 1024);
			assert.equal(result.sentBytes, 512);
			assert(result.duration >= 0, 'Duration should be non-negative');
			assert(result.latency >= 0, 'Latency should be non-negative');
			assert(result.connect >= 0, 'Connect time should be non-negative');
			assert.equal(result.error, undefined);
		});
	});

	describe('successful HTTPS request', () => {
		it('should successfully make an HTTPS request with SSL enabled', async () => {
			const testData = {
				method: 'GET',
				hostname: 'secure.example.com',
				path: '/api/secure',
				ssl: true
			};

			mockHttps.request = (options, callback) => {
				// Verify SSL options
				assert.equal(options.hostname, 'secure.example.com');
				assert.equal(options.port, 443);
				assert.equal(options.rejectUnauthorized, false);

				setImmediate(() => {
					mockReq.emit('socket');
					setImmediate(() => {
						mockSocket.emit('connect');
						setImmediate(() => {
							callback(mockRes);
							mockRes.emit('data', '{"secure": true}');
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			const result = await request(testData);

			assert(result.success, 'HTTPS request should be successful');
			assert.equal(result.body, '{"secure": true}');
		});
	});

	describe('POST request with payload', () => {
		it('should successfully make a POST request with a payload', async () => {
			const testData = {
				method: 'POST',
				hostname: 'api.example.com',
				path: '/api/submit',
				payload: '{"data": "test"}',
				headers: { 'Content-Type': 'application/json' },
				ssl: false
			};

			let writtenData = null;

			mockHttp.request = (options, callback) => {
				assert.equal(options.method, 'POST');
				assert.equal(options.headers['Content-Type'], 'application/json');

				mockReq.write = (data) => {
					writtenData = data;
				};

				setImmediate(() => {
					mockReq.emit('socket');
					setImmediate(() => {
						mockSocket.emit('connect');
						setImmediate(() => {
							callback(mockRes);
							mockRes.emit('data', '{"success": true}');
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			const result = await request(testData);

			assert.equal(writtenData, '{"data": "test"}', 'Payload should be written');
			assert(result.success, 'POST request should be successful');
		});
	});

	describe('failed request with 4xx status', () => {
		it('should mark request as failed for 4xx status codes', async () => {
			const testData = {
				method: 'GET',
				hostname: 'example.com',
				path: '/not-found',
				ssl: false
			};

			mockRes.statusCode = 404;

			mockHttp.request = (options, callback) => {
				setImmediate(() => {
					mockReq.emit('socket');
					setImmediate(() => {
						mockSocket.emit('connect');
						setImmediate(() => {
							callback(mockRes);
							mockRes.emit('data', 'Not Found');
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			const result = await request(testData);

			assert.equal(result.success, false);
			assert.equal(result.status, 404);
			assert.equal(result.error, 'Not Found');
		});
	});

	describe('failed request with 5xx status', () => {
		it('should mark request as failed for 5xx status codes', async () => {
			const testData = {
				method: 'GET',
				hostname: 'example.com',
				path: '/error',
				ssl: false
			};

			mockRes.statusCode = 500;

			mockHttp.request = (options, callback) => {
				setImmediate(() => {
					mockReq.emit('socket');
					setImmediate(() => {
						mockSocket.emit('connect');
						setImmediate(() => {
							callback(mockRes);
							mockRes.emit('data', 'Internal Server Error');
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			const result = await request(testData);

			assert.equal(result.success, false);
			assert.equal(result.status, 500);
			assert.equal(result.error, 'Internal Server Error');
		});
	});

	describe('network error', () => {
		it('should handle network errors gracefully', async () => {
			const testData = {
				method: 'GET',
				hostname: 'unreachable.example.com',
				path: '/api/test',
				ssl: false
			};

			mockHttp.request = (options, callback) => {
				setTimeout(() => {
					mockReq.emit('error', new Error('ECONNREFUSED'));
				}, 10);

				return mockReq;
			};

			const result = await request(testData);

			assert.equal(result.success, false);
			assert.equal(result.status, 0);
			assert.equal(result.error, 'ECONNREFUSED');
		});
	});

	describe('custom port', () => {
		it('should use custom port when provided', async () => {
			const testData = {
				method: 'GET',
				hostname: 'example.com',
				path: '/api/test',
				port: 8080,
				ssl: false
			};

			mockHttp.request = (options, callback) => {
				assert.equal(options.port, 8080);

				setImmediate(() => {
					mockReq.emit('socket');
					setImmediate(() => {
						mockSocket.emit('connect');
						setImmediate(() => {
							callback(mockRes);
							mockRes.emit('data', 'OK');
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			const result = await request(testData);

			assert(result.success, 'Request with custom port should succeed');
		});
	});

	describe('GET request should not write payload', () => {
		it('should not write payload for GET requests', async () => {
			const testData = {
				method: 'GET',
				hostname: 'example.com',
				path: '/api/test',
				payload: 'should not be sent',
				ssl: false
			};

			let writeWasCalled = false;

			mockHttp.request = (options, callback) => {
				mockReq.write = () => {
					writeWasCalled = true;
				};

				setImmediate(() => {
					mockReq.emit('socket');
					setImmediate(() => {
						mockSocket.emit('connect');
						setImmediate(() => {
							callback(mockRes);
							mockRes.emit('data', 'OK');
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			await request(testData);

			assert.equal(writeWasCalled, false, 'write() should not be called for GET requests');
		});
	});

	describe('HEAD request should not write payload', () => {
		it('should not write payload for HEAD requests', async () => {
			const testData = {
				method: 'HEAD',
				hostname: 'example.com',
				path: '/api/test',
				payload: 'should not be sent',
				ssl: false
			};

			let writeWasCalled = false;

			mockHttp.request = (options, callback) => {
				mockReq.write = () => {
					writeWasCalled = true;
				};

				setImmediate(() => {
					mockReq.emit('socket');
					setImmediate(() => {
						mockSocket.emit('connect');
						setImmediate(() => {
							callback(mockRes);
							mockRes.emit('end');
						});
					});
				});

				return mockReq;
			};

			await request(testData);

			assert.equal(writeWasCalled, false, 'write() should not be called for HEAD requests');
		});
	});
});

