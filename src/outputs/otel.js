import { basename } from 'path';
import { STATUS_CODES } from 'http';
import { Writable } from 'stream';
import { MeterProvider, PeriodicExportingMetricReader, AggregationType } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { logger } from '../utils/logger.js';

const scenarioName = process.argv[2];
const projectName = basename(process.cwd());

// Tuned for HTTP response times in the 500–3000ms range; more resolution there than the SDK defaults
const DEFAULT_DURATION_BUCKETS_MS = [0, 10, 25, 50, 100, 200, 300, 500, 750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 4000, 5000, 7500, 10000];
const DEFAULT_BYTES_BUCKETS = [0, 100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];

/**
 * Parses a comma-separated "key=value,key=value" header string into an object.
 * Used to interpret OTEL_EXPORTER_OTLP_HEADERS env var.
 * @param {string | undefined} headerStr
 * @returns {Record<string, string>}
 */
const parseOtlpHeaders = (headerStr) => {
	if (!headerStr) return {};
	return Object.fromEntries(
		headerStr.split(',').map((h) => h.split('=').map((s) => s.trim()))
	);
};

export class OtelStream extends Writable {
	/**
	 * @param {string} [_resultsPath] ignored; kept for consistency with other output stream constructors
	 * @param {{ endpoint?: string, headers?: Record<string,string>, exportIntervalMs?: number, runId?: string, durationBuckets?: number[], bytesBuckets?: number[] }} [options]
	 */
	constructor(_resultsPath, options = {}) {
		super({ objectMode: true });

		const scenarioStart = Date.now();
		const dt = new Date(scenarioStart).toISOString().slice(0, 16).replace(/-/g, '').replace('T', '_').replace(':', '');
		this._runId = options.runId || `${dt}-${Math.random().toString(36).slice(2, 7)}`;

		const endpoint = options.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
		const headers = options.headers || parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
		const exportIntervalMs = options.exportIntervalMs || 10000;
		const durationBuckets = options.durationBuckets || DEFAULT_DURATION_BUCKETS_MS;
		const bytesBuckets = options.bytesBuckets || DEFAULT_BYTES_BUCKETS;

		const exporter = new OTLPMetricExporter({
			url: `${endpoint}/v1/metrics`,
			headers,
		});

		this._meterProvider = new MeterProvider({
			resource: resourceFromAttributes({
				'run.id': this._runId,
				'scenario.name': scenarioName,
				'project.name': projectName,
			}),
			readers: [
				new PeriodicExportingMetricReader({
					exporter,
					exportIntervalMillis: exportIntervalMs,
				}),
			],
			views: [
				{ instrumentName: 'performance.request.duration',     aggregation: { type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM, options: { boundaries: durationBuckets } } },
				{ instrumentName: 'performance.request.latency',      aggregation: { type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM, options: { boundaries: durationBuckets } } },
				{ instrumentName: 'performance.request.connect_time', aggregation: { type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM, options: { boundaries: durationBuckets } } },
				{ instrumentName: 'performance.request.bytes_received', aggregation: { type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM, options: { boundaries: bytesBuckets } } },
				{ instrumentName: 'performance.request.bytes_sent',   aggregation: { type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM, options: { boundaries: bytesBuckets } } },
			],
		});

		const meter = this._meterProvider.getMeter('performance-library');

		this._durationHistogram = meter.createHistogram('performance.request.duration', {
			unit: 'ms',
			description: 'Total HTTP request duration',
		});
		this._latencyHistogram = meter.createHistogram('performance.request.latency', {
			unit: 'ms',
			description: 'Time to first byte (TTFB)',
		});
		this._connectHistogram = meter.createHistogram('performance.request.connect_time', {
			unit: 'ms',
			description: 'TCP connection time',
		});
		this._bytesReceivedHistogram = meter.createHistogram('performance.request.bytes_received', {
			unit: 'By',
			description: 'Response body size in bytes',
		});
		this._bytesSentHistogram = meter.createHistogram('performance.request.bytes_sent', {
			unit: 'By',
			description: 'Request body size in bytes',
		});
		this._requestCounter = meter.createCounter('performance.requests', {
			unit: '{request}',
			description: 'Total number of requests',
		});

		this._lastTotalThreads = 0;
		const activeThreadsGauge = meter.createObservableGauge('performance.active_threads', {
			unit: '{thread}',
			description: 'Number of active worker threads',
		});
		activeThreadsGauge.addCallback((result) => {
			result.observe(this._lastTotalThreads);
		});

		logger.info('Recording results to OTEL', {
			endpoint,
			runId: this._runId,
			scenarioName,
			projectName,
		});
	}

	/**
	 * @param {{ response: Record<string, any>, workerType: string, totalThreads: number, pid: number }} chunk
	 * @param {BufferEncoding} encoding
	 * @param {(error?: Error | null) => void} done
	 */
	_write({ response, workerType, totalThreads, pid }, encoding, done) {
		this._lastTotalThreads = totalThreads || 0;

		/** @type {Record<string, string | number>} */
		const attributes = {
			'request.name': String(response.name || ''),
			'http.response.status_code': response.status,
			'http.response.status_message': STATUS_CODES[response.status] || '',
			'request.success': String(response.success),
			'worker.type': String(workerType || ''),
			'process.pid': String(pid),
			'worker.thread_count': totalThreads || 0,
		};

		if (response.error) {
			attributes['request.error'] = String(response.error);
		}

		this._durationHistogram.record(response.duration || 0, attributes);
		this._latencyHistogram.record(response.latency || 0, attributes);
		this._connectHistogram.record(response.connect || 0, attributes);
		this._bytesReceivedHistogram.record(response.bytes || 0, attributes);
		this._bytesSentHistogram.record(response.sentBytes || 0, attributes);
		this._requestCounter.add(1, attributes);

		done();
	}

	/** @param {(error?: Error | null) => void} done */
	_final(done) {
		this._meterProvider.shutdown().then(() => done(), done);
	}
}
