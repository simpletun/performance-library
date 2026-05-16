
import { Writable } from 'stream';
import { sync as mkdir } from 'mkdirp';
import { createWriteStream } from 'fs';

export class JsonStream extends Writable {
	/** @param {string} outputDirectory */
	constructor(outputDirectory) {
		super({
			objectMode: true
		});

		mkdir(outputDirectory);

		this._outputStream = createWriteStream(`${outputDirectory}/${Date.now()}.json`);

		this._outputStream.write('[\n');

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
