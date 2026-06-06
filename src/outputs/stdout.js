
import { sep } from 'path';
import { Writable } from 'stream';
import { logger } from '../utils/logger.js';

const scenarioName = process.argv[2];
const projectName = import.meta.dirname.split(sep).splice(-3, 1)[0];

export class StdoutStream extends Writable {
	/**
	 * @param {string} [_resultsPath] ignored; kept for consistency with other output stream constructors
	 * @param {{ runId?: string }} [options]
	 */
	constructor(_resultsPath, options = {}) {
		super({
			objectMode: true
		});

		this._outputStream = process.stdout;

		logger.info('Recording results to stdout', {
			runId: options.runId,
			scenarioName,
			projectName
		});

		this.on('end', () => {
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
			this._outputStream.write(json + '\n');
			done();
		}
	}
}
