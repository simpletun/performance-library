
import { sep } from 'path';
import { Writable } from 'stream';
import { sync as mkdir } from 'mkdirp';
import { createWriteStream } from 'fs';
import { Stringifier } from 'csv-stringify';
import { STATUS_CODES } from 'http';
import { logger } from '../utils/logger.js';

const scenarioName = process.argv[2];
const projectName = import.meta.dirname.split(sep).splice(-3, 1)[0];

// Generates a CSV results file in a jMeter compatible format
export class CsvStream extends Writable {
	/** @type {import('csv-stringify').Stringifier} */
	_stringifier;

	/**
	 * @param {string} outputDirectory
	 * @param {{ runId?: string }} [options]
	 */
	constructor(outputDirectory, options = {}) {
		super({
			objectMode: true
		});

		mkdir(outputDirectory);

		const runId = options.runId || `${Date.now()}`;
		const outputStream = createWriteStream(`${outputDirectory}/${Date.now()}_${runId}.csv`);

		this._stringifier = new Stringifier({
			header: true,
			record_delimiter: '\n',
			columns: [
				'timeStamp',
				'elapsed',
				'label',
				'responseCode',
				'responseMessage',
				'threadName',
				'success',
				'failureMessage',
				'bytes',
				'sentBytes',
				'allThreads',
				'Latency',
				'Connect'
			]
		});

		this._stringifier.on('error', (error) => {
			this.emit('error', error);
		});

		this._stringifier.pipe(outputStream);

		logger.info('Recording results to CSV', {
			outputDirectory,
			runId,
			scenarioName,
			projectName
		});

		this.on('end', () => {
			outputStream.end();
		});
	}

	/**
	 * @param {{ response: Record<string, any>, workerType: string, totalThreads: number, pid: number }} chunk
	 * @param {BufferEncoding} encoding
	 * @param {(error?: Error | null) => void} done
	 */
	_write({ response, workerType, totalThreads, pid }, encoding, done) {
		const row = [
			response.startTime,
			response.duration,
			response.name,
			response.status,
			STATUS_CODES[response.status],
			`${workerType} [${pid}]`,
			response.success ? 'true' : 'false',
			response.error,
			response.bytes,
			response.sentBytes,
			totalThreads,
			response.latency,
			response.connect
		];

		this._stringifier.write(row, encoding, done);
	}
}
