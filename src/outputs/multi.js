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
     * @param {any} chunk
     * @param {BufferEncoding} encoding
     * @param {(error?: Error | null) => void} done
     */
    _write(chunk, encoding, done) {
        if (this._streams.length === 0) return done(null);

        let pending = this._streams.length;
        /** @type {Error | null} */
        let firstError = null;
        /** @param {Error | null | undefined} err */
        const finish = (err) => {
            if (err && !firstError) firstError = err;
            if (--pending === 0) done(firstError);
        };
        this._streams.forEach((s) => s.write(chunk, encoding, finish));
    }

    /** @param {(error?: Error | null) => void} done */
    _final(done) {
        if (this._streams.length === 0) return done(null);

        let pending = this._streams.length;
        /** @type {Error | null} */
        let firstError = null;
        /** @param {Error | undefined} err */
        const finish = (err) => {
            if (err && !firstError) firstError = err;
            if (--pending === 0) done(firstError);
        };
        this._streams.forEach((s) => s.end(finish));
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
