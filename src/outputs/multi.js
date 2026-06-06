import { Writable } from 'stream';

export class MultiStream extends Writable {
    /** @param {Writable[]} streams */
    constructor(streams) {
        super({ objectMode: true });
        this._streams = streams || [];

        // Propagate child stream errors up to the MultiStream so master.js sees them.
        // We use this.destroy(err) to ensure the stream lifecycle correctly aborts.
        let errorEmitted = false;
        this._streams.forEach((s) => s.on('error', (err) => {
            if (!errorEmitted) {
                errorEmitted = true;
                this.destroy(err);
            }
        }));
    }

    /**
     * Fan a single operation out to all child streams, collecting the first error.
     * @param {(s: Writable, finish: (err?: Error | null) => void) => void} action
     * @param {(error?: Error | null) => void} done
     */
    _fanOut(action, done) {
        if (this._streams.length === 0) return done(null);
        let pending = this._streams.length;
        /** @type {Error | null} */
        let firstError = null;
        /** @param {Error | null | undefined} err */
        const finish = (err) => {
            if (err && !firstError) firstError = err;
            if (--pending === 0) done(firstError);
        };
        this._streams.forEach((s) => action(s, finish));
    }

    /**
     * @param {any} chunk
     * @param {BufferEncoding} encoding
     * @param {(error?: Error | null) => void} done
     */
    _write(chunk, encoding, done) {
        this._fanOut((s, finish) => s.write(chunk, encoding, finish), done);
    }

    /** @param {(error?: Error | null) => void} done */
    _final(done) {
        this._fanOut((s, finish) => {
            if (s.destroyed) return finish(null);
            s.end(finish);
        }, done);
    }

    /**
     * @param {Error | null} err
     * @param {(error?: Error | null) => void} done
     */
    _destroy(err, done) {
        // Ensure all child streams are torn down if the MultiStream is destroyed
        this._streams.forEach((s) => {
            if (!s.destroyed) s.destroy(err ?? undefined);
        });
        done(err);
    }
}
