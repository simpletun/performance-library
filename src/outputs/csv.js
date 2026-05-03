
import { Writable } from 'stream';
import { sync as mkdir } from 'mkdirp';
import { createWriteStream } from 'fs';
import { Stringifier } from 'csv-stringify';
import { STATUS_CODES } from 'http';

// Generates a CSV results file in a jMeter compatible format
export class CsvStream extends Writable {
	constructor(outputDirectory) {
		super({
			objectMode: true
		});

		mkdir(outputDirectory);

		const outputStream = createWriteStream(`${outputDirectory}/${Date.now()}.csv`);

		this._stringifier = new Stringifier({
			header: true,
			rowDelimiter: '\n',
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
				'Connect',
				'productCount'
			]
		});

		this._stringifier.on('error', (error) => {
			this.emit('error', error);
		});

		this._stringifier.pipe(outputStream);

		this.on('end', () => {
			outputStream.end();
		});
	}

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
