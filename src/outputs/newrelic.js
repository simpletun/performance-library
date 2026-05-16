
import https from 'https';
import { dirname, sep } from 'path';
import { fileURLToPath } from 'url';
import { Writable } from 'stream';
import { STATUS_CODES } from 'http';
import { logger } from '../utils/logger.js';

const scenarioName = process.argv[2];
const projectName = dirname(fileURLToPath(import.meta.url)).split(sep).splice(-3, 1)[0];

export class NewrelicStream extends Writable {
	/** @param {{ accountId?: string | number, insertKey?: string }} [options] */
	constructor(options = {}) {
		super({
			objectMode: true
		});

		this._scenarioStart = Date.now();
		this._writeQueue = new NewrelicEventQueue({
			accountId: options.accountId || process.env.NEW_RELIC_ACCOUNT_ID,
			insertKey: options.insertKey || process.env.NEW_RELIC_INSERT_KEY
		});

		logger.info('Recording results to newrelic', {
			scenarioStart: this._scenarioStart,
			scenarioName,
			projectName
		});
	}

	/**
	 * @param {{ response: Record<string, any>, workerConfig: Record<string, any>, threads: Record<string, number>, pid: number }} chunk
	 * @param {BufferEncoding} encoding
	 * @param {(error?: Error | null) => void} done
	 */
	_write({ response, workerConfig, threads, pid }, encoding, done) {
		const event = {
			eventType: 'PerformanceResult',
			timestamp: response.startTime + response.duration,
			scenarioStart: this._scenarioStart,
			scenarioName: scenarioName,
			projectName: projectName,
			startTime: response.startTime,
			duration: response.duration,
			name: response.name,
			status: response.status,
			statusMessage: STATUS_CODES[response.status],
			worker: `${workerConfig.workerType} [${pid}]`,
			success: response.success ? 'true' : 'false',
			error: response.error,
			bytesReceived: response.bytes,
			bytesSent: response.sentBytes,
			workerThreads: threads.workerType,
			totalThreads: threads.total,
			latency: response.latency,
			connectTime: response.connect,
			productCount: response.productCount
		};

		this._writeQueue.push(event);
		done();
	}
}

class NewrelicEventQueue {
	/** @param {{ accountId?: string | number, insertKey?: string }} options */
	constructor({ accountId, insertKey }) {
		this.accountId = accountId;
		this.insertKey = insertKey;
		this.batchSize = 1000;
		this.batchTimeout = 10000;
		/** @type {Record<string, any>[]} */
		this.queue = [];
		this.timer = null;
	}

	/** @param {Record<string, any>} event */
	push(event) {
		this.queue.push(event);

		if (this.queue.length >= this.batchSize) {
			this.flush();
		} else if (!this.timer) {
			this.timer = setTimeout(() => this.flush(), this.batchTimeout);
		}
	}

	async flush() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.queue.length === 0) return;

		const events = [...this.queue];
		this.queue = [];

		try {
			await this.makeRequest(events);
		} catch (/** @type {any} */ err) {
			logger.error('Failed to send events to New Relic', { error: err.message || err });
		}
	}

	/**
	 * @param {Record<string, any>[]} events
	 * @returns {Promise<void>}
	 */
	makeRequest(events) {
		return new Promise((resolve, reject) => {
			const payload = JSON.stringify(events);
			const options = {
				hostname: 'insights-collector.newrelic.com',
				port: 443,
				method: 'POST',
				path: `/v1/accounts/${this.accountId}/events`,
				headers: {
					'X-Insert-Key': this.insertKey,
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(payload)
				}
			};

			const req = https.request(options, (res) => {
				res.resume(); // Consume response data to free up memory
				const statusCode = res.statusCode ?? 0;
				if (statusCode >= 200 && statusCode < 300) {
					resolve();
				} else {
					reject(new Error(`New Relic API returned status ${res.statusCode}`));
				}
			});

			req.on('error', reject);
			req.write(payload);
			req.end();
		});
	}
}
