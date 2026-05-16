// @ts-nocheck
const assert = require('assert');

// Mock modules
let mockRequestResponse = {};
let mockConfig = {};
let mockSentMessages = [];
let mockRunModeFlags = new Set();
let mockTracerSpan = null;

const mockRequest = (options) => {
	return Promise.resolve(mockRequestResponse);
};

const mockSendMessage = (type, data) => {
	mockSentMessages.push({ type, data });
};

const mockLogger = {
	silly: () => {},
	warn: () => {}
};

const mockTrace = {
	getTracer: () => ({
		startSpan: (name) => {
			mockTracerSpan = {
				name,
				attributes: {},
				ended: false,
				setAttributes: function(attrs) {
					this.attributes = { ...this.attributes, ...attrs };
				},
				end: function() {
					this.ended = true;
				}
			};
			return mockTracerSpan;
		}
	})
};

let makeRequest;
before(async () => {
	const { default: esmock } = await import('esmock');
	({ makeRequest } = await esmock('../src/utils/makeRequest.js', {
		'../src/utils/request.js': { request: mockRequest },
		'../src/worker.js': {
			get config() { return mockConfig; },
			sendMessage: mockSendMessage,
		},
		'../src/utils/logger.js': { logger: mockLogger },
		'jsonpath-plus': { JSONPath: ({ path, json }) => {
			if (path === '$.user.name' && json.user) return json.user.name;
			if (path === '$.id') return json.id;
			return null;
		}},
		'@opentelemetry/api': { trace: mockTrace },
		'../src/run-mode.js': { runModeFlags: mockRunModeFlags },
	}));
});

describe('makeRequest.js', () => {
	beforeEach(() => {
		// Reset mocks before each test
		mockRequestResponse = {
			startTime: Date.now(),
			duration: 100,
			status: 200,
			success: true,
			body: '{"message": "success"}',
			error: null,
			bytes: 512,
			sentBytes: 256,
			connect: 50,
			latency: 75
		};

		mockConfig = {
			server: {
				hostname: 'api.example.com',
				headers: { 'User-Agent': 'Test' },
				ssl: true
			}
		};

		mockSentMessages = [];
		mockRunModeFlags.clear();
		mockTracerSpan = null;
	});

	describe('successful request with defaults', () => {
		it('should successfully make a request with default configuration', async () => {
			const result = await makeRequest({
				transactionName: 'Test Transaction',
				requestConfig: {
					path: '/api/test'
				}
			});

			assert.equal(result.status, 200);
			assert.equal(mockSentMessages.length, 1);
			assert.equal(mockSentMessages[0].type, 'response');
			assert.equal(mockSentMessages[0].data.name, 'REQ - Test Transaction');
			assert.equal(mockSentMessages[0].data.success, true);
		});
	});

	describe('request with returnBody option', () => {
		it('should return body when returnBody is true', async () => {
			const result = await makeRequest({
				transactionName: 'Get Data',
				requestConfig: { path: '/api/data' },
				returnBody: true
			});

			assert.equal(result.body, '{"message": "success"}');
			assert.equal(result.status, 200);
		});

		it('should not return body when returnBody is false', async () => {
			const result = await makeRequest({
				transactionName: 'Get Data',
				requestConfig: { path: '/api/data' },
				returnBody: false
			});

			assert.equal(result.body, undefined);
			assert.equal(result.status, 200);
		});
	});

	describe('request with parseField option', () => {
		it('should parse and return a field from JSON response', async () => {
			mockRequestResponse.body = '{"user": {"name": "John"}, "id": 123}';

			const result = await makeRequest({
				transactionName: 'Get User',
				requestConfig: { path: '/api/user' },
				parseField: '$.user.name'
			});

			assert.equal(result.parsedValue, 'John');
			assert.equal(result.status, 200);
		});

		it('should handle parse errors gracefully', async () => {
			mockRequestResponse.body = 'invalid json';

			const result = await makeRequest({
				transactionName: 'Get Data',
				requestConfig: { path: '/api/data' },
				parseField: '$.field'
			});

			assert.equal(result.parsedValue, null);
		});
	});

	describe('request with ignoreError option', () => {
		it('should mark request as successful when ignoreError is true', async () => {
			mockRequestResponse.success = false;
			mockRequestResponse.status = 404;
			mockRequestResponse.error = 'Not Found';

			const result = await makeRequest({
				transactionName: 'Get Missing Resource',
				requestConfig: { path: '/api/missing' },
				ignoreError: true
			});

			assert.equal(mockSentMessages[0].data.success, true, 'Should report success when ignoreError is true');
			assert.equal(result.status, 404);
		});
	});

	describe('request with ignoredCodes option', () => {
		it('should mark request as successful when status is in ignoredCodes', async () => {
			mockRequestResponse.success = false;
			mockRequestResponse.status = 404;

			await makeRequest({
				transactionName: 'Get Missing Resource',
				requestConfig: { path: '/api/missing' },
				ignoredCodes: ['404', '500']
			});

			assert.equal(mockSentMessages[0].data.success, true, 'Should report success for ignored status code');
		});

		it('should still report failure for non-ignored codes', async () => {
			mockRequestResponse.success = false;
			mockRequestResponse.status = 500;

			await makeRequest({
				transactionName: 'Server Error',
				requestConfig: { path: '/api/error' },
				ignoredCodes: ['404']
			});

			assert.equal(mockSentMessages[0].data.success, false, 'Should report failure for non-ignored code');
		});
	});

	describe('request with trackRequest option', () => {
		it('should track request when trackRequest is true', async () => {
			await makeRequest({
				transactionName: 'Tracked Request',
				requestConfig: { path: '/api/track' },
				trackRequest: true
			});

			assert.equal(mockSentMessages.length, 1);
		});

		it('should not track request when trackRequest is false', async () => {
			await makeRequest({
				transactionName: 'Untracked Request',
				requestConfig: { path: '/api/notrack' },
				trackRequest: false
			});

			assert.equal(mockSentMessages.length, 0);
		});
	});

	describe('request config merging', () => {
		it('should merge request config with default config', async () => {
			// This is implicit - we can't easily verify the internal call
			// but we can verify the request succeeds
			const result = await makeRequest({
				transactionName: 'Custom Request',
				requestConfig: {
					path: '/api/custom',
					method: 'POST',
					headers: { 'Custom-Header': 'value' }
				}
			});

			assert.equal(result.status, 200);
		});
	});

	describe('failed request handling', () => {
		it('should handle failed requests', async () => {
			mockRequestResponse.success = false;
			mockRequestResponse.status = 500;
			mockRequestResponse.error = 'Internal Server Error';

			const result = await makeRequest({
				transactionName: 'Failed Request',
				requestConfig: { path: '/api/error' }
			});

			assert.equal(result.status, 500);
			assert.equal(mockSentMessages[0].data.success, false);
			assert.equal(mockSentMessages[0].data.error, 'Internal Server Error');
		});
	});

	describe('returnBody with failed request', () => {
		it('should not return body when request fails and returnBody is true', async () => {
			mockRequestResponse.success = false;
			mockRequestResponse.status = 404;

			const result = await makeRequest({
				transactionName: 'Failed Request',
				requestConfig: { path: '/api/missing' },
				returnBody: true
			});

			assert.equal(result.body, undefined, 'Body should not be returned on failure');
			assert.equal(result.status, 404);
		});
	});

	describe('parseField with failed request', () => {
		it('should not return parsed value when request fails', async () => {
			mockRequestResponse.success = false;
			mockRequestResponse.status = 500;

			const result = await makeRequest({
				transactionName: 'Failed Request',
				requestConfig: { path: '/api/error' },
				parseField: '$.data'
			});

			assert.equal(result.parsedValue, undefined, 'Parsed value should not be returned on failure');
			assert.equal(result.status, 500);
		});
	});

	describe('SignalFx tracing integration', () => {
		it('should create span when signalfx mode is enabled', async () => {
			mockRunModeFlags.add('signalfx');

			await makeRequest({
				transactionName: 'Traced Request',
				requestConfig: { path: '/api/traced' }
			});

			assert(mockTracerSpan !== null, 'Span should be created');
			assert.equal(mockTracerSpan.name, 'Traced Request');
			assert(mockTracerSpan.ended, 'Span should be ended');
			assert.equal(mockTracerSpan.attributes['perf.res.status'], 200);
			assert.equal(mockTracerSpan.attributes['perf.res.success'], true);
		});

		it('should not create span when signalfx mode is disabled', async () => {
			await makeRequest({
				transactionName: 'Untraced Request',
				requestConfig: { path: '/api/untraced' }
			});

			assert.equal(mockTracerSpan, null, 'Span should not be created');
		});

		it('should set error attributes in span for failed requests', async () => {
			mockRunModeFlags.add('signalfx');
			mockRequestResponse.success = false;
			mockRequestResponse.status = 500;
			mockRequestResponse.error = 'Server Error';

			await makeRequest({
				transactionName: 'Failed Traced Request',
				requestConfig: { path: '/api/error' }
			});

			assert.equal(mockTracerSpan.attributes['perf.res.status'], 500);
			assert.equal(mockTracerSpan.attributes['perf.res.success'], false);
			assert.equal(mockTracerSpan.attributes['perf.res.error'], 'Server Error');
		});
	});

	describe('message data structure', () => {
		it('should send complete response data in message', async () => {
			await makeRequest({
				transactionName: 'Complete Data Request',
				requestConfig: { path: '/api/complete' }
			});

			const message = mockSentMessages[0];

			assert.equal(message.type, 'response');
			assert(message.data.startTime !== undefined);
			assert.equal(message.data.duration, 100);
			assert.equal(message.data.status, 200);
			assert.equal(message.data.success, true);
			assert.equal(message.data.bytes, 512);
			assert.equal(message.data.sentBytes, 256);
			assert.equal(message.data.connect, 50);
			assert.equal(message.data.latency, 75);
			assert.equal(message.data.path, '/api/complete');
		});
	});
});

