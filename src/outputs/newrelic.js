
import https from 'https';
import { sep } from 'path';
import { Writable } from 'stream';
import { STATUS_CODES } from 'http';
import { logger } from '../utils/logger';
import { RequestQueue } from '@gtm-av/js-request-queue';

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

		this._writeQueue.request(event);
		done();
	}
}

class NewrelicEventQueue extends RequestQueue {
	constructor({ accountId, insertKey }) {
		super({
			batchSize: 1000,
			batchTimeout: 10000,
			variables: [ ]
		});

		this.accountId = accountId;
		this.insertKey = insertKey;
	}

	makeRequest(events) {
		const result = new Map();

		events.forEach((event) => {
			result.set(event, null);
		});

		return new Promise((resolve, reject) => {
			const payload = JSON.stringify(events);
			const options = {
				hostname: 'insights-collector.newrelic.com',
				port: 443,
				method: 'POST',
				path: `/v1/accounts/${this.accountId}/events`,
				headers: {
					'X-Insert-Key': this.insertKey,
					'Content-Type': 'application/json'
				}
			};

			const req = https.request(options, (res) => {
				res.on('end', () => {
					if (res.statusCode < 400) {
						resolve(result);
					}

					else {
						reject('Received an error response from newrelic');
					}
				});
			});

			req.on('error', reject);
			req.write(payload);
			req.end();
		});
	}
}
