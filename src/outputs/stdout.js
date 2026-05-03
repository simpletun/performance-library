
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

	_write(chunk, encoding, done) {
		let json;

		try {
			json = JSON.stringify(chunk);
		}

		catch (err) {
			return done(err);
		}

		if (json) {
			this._outputStream.write(json + '\n');
			done();
		}
	}
}
