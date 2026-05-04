import http from 'http';
import https from 'https';
import { sep } from 'path';
import { Writable } from 'stream';
import { logger } from '../utils/logger';

const scenarioName = process.argv[2];
const projectName = __dirname.split(sep).splice(-3, 1)[0];

// Escapes spaces, commas, and equals signs for InfluxDB Line Protocol tags
const escapeTag = (str) => String(str || '').replace(/([,= ])/g, '\\$1');

export class InfluxDbStream extends Writable {
	constructor(options = {}) {
		super({
			objectMode: true
		});

		this._scenarioStart = Date.now();
		
		// Configuration defaults to options, falling back to Environment Variables
		this._writeQueue = new InfluxDbEventQueue({
			url: options.url || process.env.INFLUX_URL || 'http://localhost:8086',
			token: options.token || process.env.INFLUX_TOKEN,
			org: options.org || process.env.INFLUX_ORG,
			bucket: options.bucket || process.env.INFLUX_BUCKET
		});

		logger.info('Recording results to InfluxDB', {
			scenarioStart: this._scenarioStart,
			scenarioName,
			projectName
		});
	}

	_write({ response, workerConfig, threads, pid }, encoding, done) {
		// Format the tags (Indexed fields used for querying)
		const tags = [
			`scenarioName=${escapeTag(scenarioName)}`,
			`projectName=${escapeTag(projectName)}`,
			`workerType=${escapeTag(workerConfig.workerType)}`,
			`pid=${pid}`,
			`success=${response.success ? 'true' : 'false'}`,
			`status=${response.status}`
		].join(',');

		// Format the fields (Unindexed data like durations and sizes). 
		// The 'i' suffix tells InfluxDB to store the value as an integer for better performance.
		const fields = [
			`duration=${response.duration || 0}i`,
			`bytesReceived=${response.bytes || 0}i`,
			`bytesSent=${response.sentBytes || 0}i`,
			`workerThreads=${threads.workerType || 0}i`,
			`totalThreads=${threads.total || 0}i`,
			`latency=${response.latency || 0}i`,
			`connectTime=${response.connect || 0}i`,
			`productCount=${response.productCount || 0}i`
		].join(',');

		// Timestamp must be in the precision format specified in the API request (ms)
		const timestamp = response.startTime + response.duration;

		// Assemble the complete InfluxDB Line Protocol string
		const line = `performance_result,${tags} ${fields} ${timestamp}`;

		this._writeQueue.push(line);
		done();
	}
}

class InfluxDbEventQueue {
	constructor({ url, token, org, bucket }) {
		this.url = url;
		this.token = token;
		this.org = org;
		this.bucket = bucket;
		
		this.batchSize = 1000;
		this.batchTimeout = 10000;
		this.queue = [];
		this.timer = null;
	}

	push(line) {
		this.queue.push(line);

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

		const lines = [...this.queue];
		this.queue = [];

		try {
			await this.makeRequest(lines);
		} catch (err) {
			logger.error('Failed to send events to InfluxDB', { error: err.message || err });
		}
	}

	makeRequest(lines) {
		return new Promise((resolve, reject) => {
			if (!this.url || !this.token || !this.org || !this.bucket) {
				return reject(new Error('Missing InfluxDB configuration (url, token, org, bucket)'));
			}

			const payload = lines.join('\n');
			const parsedUrl = new URL(this.url);
			const apiPath = `/api/v2/write?org=${encodeURIComponent(this.org)}&bucket=${encodeURIComponent(this.bucket)}&precision=ms`;
			
			const options = {
				hostname: parsedUrl.hostname,
				port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
				method: 'POST',
				path: apiPath,
				headers: {
					'Authorization': `Token ${this.token}`,
					'Content-Type': 'text/plain; charset=utf-8',
					'Content-Length': Buffer.byteLength(payload)
				}
			};

			const requestClient = parsedUrl.protocol === 'https:' ? https : http;
			const req = requestClient.request(options, (res) => {
				res.resume(); // Consume response data to free up memory
				if (res.statusCode >= 200 && res.statusCode < 300) {
					resolve();
				} else {
					let body = '';
					res.on('data', chunk => body += chunk);
					res.on('end', () => {
						reject(new Error(`InfluxDB API returned status ${res.statusCode}: ${body}`));
					});
				}
			});

			req.on('error', reject);
			req.write(payload);
			req.end();
		});
	}
}