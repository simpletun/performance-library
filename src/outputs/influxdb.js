import http from 'http';
import https from 'https';
import { sep } from 'path';
import { Writable } from 'stream';
import { STATUS_CODES } from 'http';
import { logger } from '../utils/logger.js';

const scenarioName = process.argv[2];
const projectName = import.meta.dirname.split(sep).splice(-3, 1)[0];

// Escapes spaces, commas, and equals signs for InfluxDB Line Protocol tags
/** @param {any} str */
const escapeTag = (str) => String(str || '').replace(/([,= ])/g, '\\$1');

// Escapes double quotes and backslashes for InfluxDB Line Protocol string fields
/** @param {any} str */
const escapeFieldString = (str) => String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export class InfluxDbStream extends Writable {
	/** @param {{ url?: string, token?: string, org?: string, bucket?: string }} [options] */
	constructor(options = {}) {
		super({
			objectMode: true
		});

		this._scenarioStart = Date.now();
		this._runId = `${this._scenarioStart.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
		
		// Configuration defaults to options, falling back to Environment Variables
		this._writeQueue = new InfluxDbEventQueue({
			url: options.url || process.env.INFLUX_URL || 'http://localhost:8086',
			token: options.token || process.env.INFLUX_TOKEN,
			org: options.org || process.env.INFLUX_ORG,
			bucket: options.bucket || process.env.INFLUX_BUCKET
		});

		logger.info('Recording results to InfluxDB', {
			scenarioStart: this._scenarioStart,
			runId: this._runId,
			scenarioName,
			projectName
		});
	}

	/**
	 * @param {{ response: Record<string, any>, workerType: string, totalThreads: number, pid: number }} chunk
	 * @param {BufferEncoding} encoding
	 * @param {(error?: Error | null) => void} done
	 */
	_write({ response, workerType, totalThreads, pid }, encoding, done) {
		// Format the tags (Indexed fields used for querying)
		const tags = [
			`runId=${escapeTag(this._runId)}`,
			`scenarioName=${escapeTag(scenarioName)}`,
			`projectName=${escapeTag(projectName)}`,
			`workerType=${escapeTag(workerType)}`,
			`pid=${pid}`,
			`name=${escapeTag(response.name)}`,
			`success=${response.success ? 'true' : 'false'}`,
			`status=${response.status}`
		].join(',');

		// Format the fields (Unindexed data like durations and sizes).
		// The 'i' suffix tells InfluxDB to store the value as an integer for better performance.
		const fields = [
			`duration_ms=${response.duration || 0}i`,
			`bytesReceived=${response.bytes || 0}i`,
			`bytesSent=${response.sentBytes || 0}i`,
			`totalThreads=${totalThreads || 0}i`,
			`latency_ms=${response.latency || 0}i`,
			`connectTime_ms=${response.connect || 0}i`,
			`statusMessage="${escapeFieldString(STATUS_CODES[response.status])}"`,
			`error="${escapeFieldString(response.error)}"`,
			`is_error=${response.error ? 'true' : 'false'}`
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
	/** @param {{ url: string, token: string | undefined, org: string | undefined, bucket: string | undefined }} options */
	constructor({ url, token, org, bucket }) {
		this.url = url;
		this.token = token;
		this.org = org;
		this.bucket = bucket;
		
		this.batchSize = 1000;
		this.batchTimeout = 10000;
		/** @type {string[]} */
		this.queue = [];
		this.timer = null;
	}

	/** @param {string} line */
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
		} catch (/** @type {any} */ err) {
			logger.error('Failed to send events to InfluxDB', { error: err.message || err });
		}
	}

	/**
	 * @param {string[]} lines
	 * @returns {Promise<void>}
	 */
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
				const statusCode = res.statusCode ?? 0;
				if (statusCode >= 200 && statusCode < 300) {
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