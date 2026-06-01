// @ts-nocheck
const assert = require('assert');

// --- Instrument spies ---
let recordedDuration = [];
let recordedLatency = [];
let recordedConnect = [];
let recordedBytesReceived = [];
let recordedBytesSent = [];
let recordedRequests = [];
let shutdownCalled = false;
let activeThreadsCallback = null;
let capturedViews = [];

const makeSpy = (store) => ({
	record: (val, attrs) => store.push({ val, attrs }),
	add:    (val, attrs) => store.push({ val, attrs }),
});

const mockMeter = {
	createHistogram: (name) => {
		if (name === 'performance.request.duration')       return makeSpy(recordedDuration);
		if (name === 'performance.request.latency')        return makeSpy(recordedLatency);
		if (name === 'performance.request.connect_time')   return makeSpy(recordedConnect);
		if (name === 'performance.request.bytes_received') return makeSpy(recordedBytesReceived);
		if (name === 'performance.request.bytes_sent')     return makeSpy(recordedBytesSent);
		throw new Error(`Unexpected histogram: ${name}`);
	},
	createCounter: (name) => {
		if (name === 'performance.requests') return makeSpy(recordedRequests);
		throw new Error(`Unexpected counter: ${name}`);
	},
	createObservableGauge: (name) => {
		if (name === 'performance.active_threads') return { addCallback: (fn) => { activeThreadsCallback = fn; } };
		throw new Error(`Unexpected gauge: ${name}`);
	},
};

const mockMeterProvider = {
	getMeter: () => mockMeter,
	shutdown: () => { shutdownCalled = true; return Promise.resolve(); },
};

const mockLogger = { info: () => {}, error: () => {} };

let OtelStream;
before(async () => {
	const { default: esmock } = await import('esmock');
	({ OtelStream } = await esmock('../src/outputs/otel.js', {
		'@opentelemetry/sdk-metrics': {
			MeterProvider: function(opts) { capturedViews = opts?.views || []; return mockMeterProvider; },
			PeriodicExportingMetricReader: function() { return {}; },
			AggregationType: { EXPLICIT_BUCKET_HISTOGRAM: 'EXPLICIT_BUCKET_HISTOGRAM' },
		},
		'@opentelemetry/exporter-metrics-otlp-http': {
			OTLPMetricExporter: function() { return {}; },
		},
		'@opentelemetry/resources': {
			resourceFromAttributes: () => ({}),
		},
		'../src/utils/logger.js': { logger: mockLogger },
	}));
});

const makeChunk = (overrides = {}) => ({
	response: {
		name: 'REQ - my-transaction',
		startTime: Date.now(),
		duration: 120,
		status: 200,
		success: true,
		error: null,
		bytes: 1024,
		sentBytes: 256,
		latency: 80,
		connect: 30,
		...overrides.response,
	},
	workerType: 'http-worker',
	totalThreads: 5,
	pid: 1234,
	...overrides,
});

describe('OtelStream', () => {
	let stream;

	beforeEach(() => {
		recordedDuration = [];
		recordedLatency = [];
		recordedConnect = [];
		recordedBytesReceived = [];
		recordedBytesSent = [];
		recordedRequests = [];
		shutdownCalled = false;
		activeThreadsCallback = null;
		capturedViews = [];
		stream = new OtelStream();
	});

	describe('_write records all instruments', () => {
		it('records duration histogram', (done) => {
			stream.write(makeChunk(), () => {
				assert.equal(recordedDuration.length, 1);
				assert.equal(recordedDuration[0].val, 120);
				done();
			});
		});

		it('records latency histogram', (done) => {
			stream.write(makeChunk(), () => {
				assert.equal(recordedLatency.length, 1);
				assert.equal(recordedLatency[0].val, 80);
				done();
			});
		});

		it('records connect_time histogram', (done) => {
			stream.write(makeChunk(), () => {
				assert.equal(recordedConnect.length, 1);
				assert.equal(recordedConnect[0].val, 30);
				done();
			});
		});

		it('records bytes_received histogram', (done) => {
			stream.write(makeChunk(), () => {
				assert.equal(recordedBytesReceived.length, 1);
				assert.equal(recordedBytesReceived[0].val, 1024);
				done();
			});
		});

		it('records bytes_sent histogram', (done) => {
			stream.write(makeChunk(), () => {
				assert.equal(recordedBytesSent.length, 1);
				assert.equal(recordedBytesSent[0].val, 256);
				done();
			});
		});

		it('increments request counter', (done) => {
			stream.write(makeChunk(), () => {
				assert.equal(recordedRequests.length, 1);
				assert.equal(recordedRequests[0].val, 1);
				done();
			});
		});
	});

	describe('attributes', () => {
		it('sets expected attributes from chunk', (done) => {
			stream.write(makeChunk(), () => {
				const attrs = recordedDuration[0].attrs;
				assert.equal(attrs['request.name'], 'REQ - my-transaction');
				assert.equal(attrs['http.response.status_code'], 200);
				assert.equal(attrs['http.response.status_message'], 'OK');
				assert.equal(attrs['request.success'], 'true');
				assert.equal(attrs['worker.type'], 'http-worker');
				assert.equal(attrs['process.pid'], '1234');
				assert.equal(attrs['worker.thread_count'], 5);
				done();
			});
		});

		it('omits request.error attribute when no error', (done) => {
			stream.write(makeChunk(), () => {
				assert.equal(recordedDuration[0].attrs['request.error'], undefined);
				done();
			});
		});

		it('includes request.error attribute when error is set', (done) => {
			stream.write(makeChunk({ response: { error: 'Connection refused' } }), () => {
				assert.equal(recordedDuration[0].attrs['request.error'], 'Connection refused');
				done();
			});
		});

		it('sets request.success to false string for failed requests', (done) => {
			stream.write(makeChunk({ response: { success: false, status: 500 } }), () => {
				assert.equal(recordedDuration[0].attrs['request.success'], 'false');
				done();
			});
		});
	});

	describe('missing optional fields', () => {
		it('defaults missing numeric fields to 0 without throwing', (done) => {
			const chunk = makeChunk();
			delete chunk.response.latency;
			delete chunk.response.connect;
			delete chunk.response.bytes;
			delete chunk.response.sentBytes;
			delete chunk.response.duration;

			stream.write(chunk, (err) => {
				assert.equal(err, undefined);
				assert.equal(recordedDuration[0].val, 0);
				assert.equal(recordedLatency[0].val, 0);
				assert.equal(recordedConnect[0].val, 0);
				assert.equal(recordedBytesReceived[0].val, 0);
				assert.equal(recordedBytesSent[0].val, 0);
				done();
			});
		});
	});

	describe('active threads gauge', () => {
		it('registers an observable gauge callback on construction', () => {
			assert.ok(activeThreadsCallback, 'gauge callback should be registered');
		});

		it('gauge callback reports last seen totalThreads', (done) => {
			stream.write(makeChunk({ totalThreads: 8 }), () => {
				const result = { observed: null };
				activeThreadsCallback({ observe: (val) => { result.observed = val; } });
				assert.equal(result.observed, 8);
				done();
			});
		});

		it('gauge callback reports most recent totalThreads after multiple writes', (done) => {
			stream.write(makeChunk({ totalThreads: 3 }), () => {
				stream.write(makeChunk({ totalThreads: 7 }), () => {
					const result = { observed: null };
					activeThreadsCallback({ observe: (val) => { result.observed = val; } });
					assert.equal(result.observed, 7);
					done();
				});
			});
		});

		it('gauge callback reports 0 before any writes', () => {
			const result = { observed: null };
			activeThreadsCallback({ observe: (val) => { result.observed = val; } });
			assert.equal(result.observed, 0);
		});
	});

	describe('histogram bucket configuration', () => {
		it('passes five views to MeterProvider covering all histograms', () => {
			assert.equal(capturedViews.length, 5);
			const names = capturedViews.map((v) => v.instrumentName);
			assert.ok(names.includes('performance.request.duration'));
			assert.ok(names.includes('performance.request.latency'));
			assert.ok(names.includes('performance.request.connect_time'));
			assert.ok(names.includes('performance.request.bytes_received'));
			assert.ok(names.includes('performance.request.bytes_sent'));
		});

		it('uses EXPLICIT_BUCKET_HISTOGRAM aggregation type for all views', () => {
			capturedViews.forEach((v) => {
				assert.equal(v.aggregation.type, 'EXPLICIT_BUCKET_HISTOGRAM');
			});
		});

		it('uses custom durationBuckets when provided', () => {
			capturedViews = [];
			const customBuckets = [0, 500, 1000, 2000];
			new OtelStream('', { durationBuckets: customBuckets });
			const durationView = capturedViews.find((v) => v.instrumentName === 'performance.request.duration');
			assert.deepEqual(durationView.aggregation.options.boundaries, customBuckets);
		});

		it('uses custom bytesBuckets when provided', () => {
			capturedViews = [];
			const customBuckets = [0, 512, 4096];
			new OtelStream('', { bytesBuckets: customBuckets });
			const bytesView = capturedViews.find((v) => v.instrumentName === 'performance.request.bytes_received');
			assert.deepEqual(bytesView.aggregation.options.boundaries, customBuckets);
		});
	});

	describe('_final', () => {
		it('calls meterProvider.shutdown() when stream ends', (done) => {
			stream.end(() => {
				assert.equal(shutdownCalled, true);
				done();
			});
		});
	});
});
