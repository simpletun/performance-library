
import https from 'https';
import { sep } from 'path';
import { Writable } from 'stream';
import { STATUS_CODES } from 'http';
import { logger } from '../utils/logger';

const scenarioName = process.argv[2];
const projectName = __dirname.split(sep).splice(-3, 1)[0];

export class NewrelicStream extends Writable {
	constructor() {
		super({
			objectMode: true
		});

		this._scenarioStart = Date.now();
		this._writeQueue = new NewrelicEventQueue({
			accountId: 1349703,
			insertKey: 'T8b9Q15Gg1yAO1Lml6tnELsTqHKx95Qy'
		});

		logger.info('Recording results to newrelic', {
			scenarioStart: this._scenarioStart,
			scenarioName,
			projectName
		});
	}

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
	constructor({ accountId, insertKey }) {
		this.accountId = accountId;
		this.insertKey = insertKey;
		this.batchSize = 1000;
		this.batchTimeout = 10000;
		this.queue = [];
		this.timer = null;
	}

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
		} catch (err) {
			logger.error('Failed to send events to New Relic', { error: err.message || err });
		}
	}

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
				if (res.statusCode >= 200 && res.statusCode < 300) {
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
