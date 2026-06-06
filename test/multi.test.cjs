// @ts-nocheck
'use strict';
const assert = require('assert');
const { Writable, PassThrough } = require('stream');

let MultiStream;
before(async () => {
    ({ MultiStream } = await import('../src/outputs/multi.js'));
});

// Build a simple in-memory writable that collects written chunks.
const makeCollector = () => {
    const chunks = [];
    const stream = new Writable({
        objectMode: true,
        write(chunk, _enc, done) { chunks.push(chunk); done(); },
    });
    stream._chunks = chunks;
    return stream;
};

// Build a writable whose write() always calls back with an error.
const makeErrorStream = (msg = 'write error') => {
    const stream = new Writable({
        objectMode: true,
        write(_chunk, _enc, done) { done(new Error(msg)); },
    });
    return stream;
};

// Helper: write a chunk and return a promise that resolves with the callback error (or null).
const writeChunk = (stream, chunk) =>
    new Promise((resolve) => stream.write(chunk, resolve));

describe('MultiStream', () => {
    describe('constructor', () => {
        it('accepts an empty array without throwing', () => {
            assert.doesNotThrow(() => new MultiStream([]));
        });

        it('defaults _streams to [] when called with no argument', () => {
            const ms = new MultiStream();
            assert.deepEqual(ms._streams, []);
        });

        it('stores the provided streams array', () => {
            const a = makeCollector();
            const b = makeCollector();
            const ms = new MultiStream([a, b]);
            assert.equal(ms._streams.length, 2);
        });
    });

    describe('_write fan-out', () => {
        it('delivers a chunk to all child streams', async () => {
            const a = makeCollector();
            const b = makeCollector();
            const ms = new MultiStream([a, b]);

            await writeChunk(ms, { value: 1 });

            assert.equal(a._chunks.length, 1);
            assert.equal(b._chunks.length, 1);
            assert.deepEqual(a._chunks[0], { value: 1 });
            assert.deepEqual(b._chunks[0], { value: 1 });
        });

        it('delivers multiple chunks in order to all children', async () => {
            const a = makeCollector();
            const b = makeCollector();
            const ms = new MultiStream([a, b]);

            await writeChunk(ms, 'first');
            await writeChunk(ms, 'second');
            await writeChunk(ms, 'third');

            assert.deepEqual(a._chunks, ['first', 'second', 'third']);
            assert.deepEqual(b._chunks, ['first', 'second', 'third']);
        });

        it('calls done without error when all children succeed', async () => {
            const ms = new MultiStream([makeCollector(), makeCollector()]);
            const err = await writeChunk(ms, 'x');
            assert.strictEqual(err, null);
        });

        it('calls done without error when stream list is empty', async () => {
            const ms = new MultiStream([]);
            const err = await writeChunk(ms, 'x');
            assert.strictEqual(err, null);
        });

        it('passes the first child error back through done', (done) => {
            const good = makeCollector();
            const bad  = makeErrorStream('boom');
            const ms = new MultiStream([good, bad]);
            // Absorb the destroy-triggered 'error' event so it doesn't become unhandled.
            ms.on('error', () => {});

            ms.write('x', (err) => {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'boom');
                done();
            });
        });

        it('still writes to all children even when one errors', (done) => {
            const good = makeCollector();
            const bad  = makeErrorStream('oops');
            // Use [bad, good] so we can prove it didn't just bail out on the first failure
            const ms = new MultiStream([bad, good]);
            ms.on('error', () => {});

            ms.write('payload', (err) => {
                assert.ok(err instanceof Error, 'should pass back the error');
                assert.strictEqual(err.message, 'oops');
                assert.equal(good._chunks[0], 'payload');
                done();
            });
        });
    });

    describe('_final fan-out', () => {
        it('ends all child streams on MultiStream.end()', (done) => {
            const a = makeCollector();
            const b = makeCollector();
            const ms = new MultiStream([a, b]);

            ms.end(() => {
                assert.ok(a.writableEnded, 'stream a should be ended');
                assert.ok(b.writableEnded, 'stream b should be ended');
                done();
            });
        });

        it('resolves cleanly when stream list is empty', (done) => {
            const ms = new MultiStream([]);
            ms.end(done);
        });

        it('does not hang when a child is already destroyed before _final runs', (done) => {
            const a = makeCollector();
            const b = makeCollector();
            b.destroy(); // pre-destroy one child
            const ms = new MultiStream([a, b]);

            ms.end(() => {
                assert.ok(a.writableEnded, 'live child should be ended');
                done();
            });
        });

        it('surfaces a child _final error through the callback', (done) => {
            const badFinal = new Writable({
                objectMode: true,
                write(_c, _e, cb) { cb(); },
                final(cb) { cb(new Error('final error')); },
            });
            const ms = new MultiStream([badFinal]);
            // Absorb the destroy-triggered 'error' event so it doesn't become unhandled.
            ms.on('error', () => {});

            ms.end((err) => {
                assert.ok(err instanceof Error);
                assert.equal(err.message, 'final error');
                done();
            });
        });
    });

    describe('_destroy propagation', () => {
        it('destroys all child streams when MultiStream is destroyed', (done) => {
            const a = makeCollector();
            const b = makeCollector();
            const ms = new MultiStream([a, b]);

            ms.destroy();

            // destroy is synchronous for simple Writables; allow one tick for propagation
            setImmediate(() => {
                assert.ok(a.destroyed, 'stream a should be destroyed');
                assert.ok(b.destroyed, 'stream b should be destroyed');
                done();
            });
        });

        it('does not re-destroy already-destroyed children', (done) => {
            const a = makeCollector();
            a.destroy(); // pre-destroy

            const ms = new MultiStream([a]);
            let destroyCallCount = 0;
            const origDestroy = a.destroy.bind(a);
            a.destroy = (...args) => { destroyCallCount++; return origDestroy(...args); };

            ms.destroy();
            setImmediate(() => {
                assert.equal(destroyCallCount, 0, 'should not call destroy on already-destroyed child');
                done();
            });
        });
    });

    describe('error propagation from child streams', () => {
        it('emits an error on MultiStream when a child emits an error', (done) => {
            const a = new PassThrough({ objectMode: true });
            const ms = new MultiStream([a]);

            ms.once('error', (err) => {
                assert.equal(err.message, 'child error');
                done();
            });

            a.emit('error', new Error('child error'));
        });

        it('only propagates the first child error when multiple children error', (done) => {
            const a = new PassThrough({ objectMode: true });
            const b = new PassThrough({ objectMode: true });
            const ms = new MultiStream([a, b]);

            const seen = [];
            ms.on('error', (err) => seen.push(err.message));

            a.emit('error', new Error('first'));
            b.emit('error', new Error('second'));

            setImmediate(() => {
                assert.equal(seen.length, 1);
                assert.equal(seen[0], 'first');
                done();
            });
        });
    });
});
