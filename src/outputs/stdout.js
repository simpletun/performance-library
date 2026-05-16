
import { Writable } from 'stream';

export class StdoutStream extends Writable {
	constructor() {
		super({
			objectMode: true
		});

		this._outputStream = process.stdout;

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
