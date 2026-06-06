
import { sep } from 'path';
import { Writable } from 'stream';
import { sync as mkdir } from 'mkdirp';
import { createWriteStream } from 'fs';
import { logger } from '../utils/logger.js';

const scenarioName = process.argv[2];
const projectName = import.meta.dirname.split(sep).splice(-3, 1)[0];

export class JsonStream extends Writable {
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
		this._outputStream = createWriteStream(`${outputDirectory}/${Date.now()}_${runId}.json`);

		this._outputStream.write('[\n');

		logger.info('Recording results to JSON', {
			outputDirectory,
			runId,
			scenarioName,
			projectName
		});

		this.on('end', () => {
			this._outputStream.write(']');
			this._outputStream.end();
		});
	}

	/**
	 * @param {any} chunk
	 * @param {BufferEncoding} encoding
	 * @param {(error?: Error | null) => void} done
	 */
	_write(chunk, encoding, done) {
		let json;

		try {
			json = JSON.stringify(chunk);
		}

		catch (/** @type {any} */ err) {
			return done(err);
		}

		if (json) {
			if (this._hasPreviousRecord) {
				this._outputStream.write(',\n');
			}

			this._outputStream.write(json);
			this._hasPreviousRecord = true;
			done();
		}
	}
}
