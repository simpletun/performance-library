// @ts-nocheck
'use strict';
const assert = require('assert');
const http = require('http');

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, verbose: () => {}, silly: () => {} };

let InfluxDbStream;
before(async () => {
    const { default: esmock } = await import('esmock');
    ({ InfluxDbStream } = await esmock('../src/outputs/influxdb.js', {
        '../src/utils/logger.js': { logger: mockLogger },
    }));
});

// Minimal valid chunk shape expected by InfluxDbStream._write
const makeChunk = (overrides = {}) => ({
    response: { name: 'test', success: true, status: 200, duration: 100, startTime: Date.now() - 100, bytes: 0, sentBytes: 0, latency: 0, connect: 0, error: null },
    workerType: 'worker',
    totalThreads: 1,
    pid: 1,
    ...overrides,
});

// Spin up a minimal HTTP server that responds with the given status code.
const makeServer = (statusCode, responseBody = '') =>
    new Promise((resolve) => {
        const server = http.createServer((_req, res) => {
            res.writeHead(statusCode);
            res.end(responseBody);
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });

describe('InfluxDbStream', () => {
    describe('_final', () => {
        it('calls done() without error when the final flush succeeds', function (done) {
            this.timeout(3000);
            makeServer(204).then((server) => {
                const { port } = server.address();
                const stream = new InfluxDbStream('/tmp', {
                    url: `http://127.0.0.1:${port}`,
                    token: 'tok',
                    org: 'org',
                    bucket: 'bucket',
                });

                // Write one chunk so the queue is non-empty at end time
                stream.write(makeChunk(), () => {
                    stream._final((err) => {
                        server.close();
                        assert.strictEqual(err, undefined, 'done should be called without error');
                        done();
                    });
                });
            });
        });

        it('calls done(err) when the final flush fails', function (done) {
            this.timeout(3000);
            makeServer(500, 'server error').then((server) => {
                const { port } = server.address();
                const stream = new InfluxDbStream('/tmp', {
                    url: `http://127.0.0.1:${port}`,
                    token: 'tok',
                    org: 'org',
                    bucket: 'bucket',
                });

                stream.write(makeChunk(), () => {
                    stream._final((err) => {
                        server.close();
                        assert.ok(err instanceof Error, 'done should receive an Error');
                        assert.ok(err.message.includes('500'), 'error message should include the status code');
                        done();
                    });
                });
            });
        });

        it('calls done() cleanly when the queue is already empty', function (done) {
            // No writes — _final should resolve immediately via the early-return in flush()
            const stream = new InfluxDbStream('/tmp', {
                url: 'http://127.0.0.1:1',  // unreachable — queue is empty so no request fires
                token: 'tok',
                org: 'org',
                bucket: 'bucket',
            });
            stream._final((err) => {
                assert.strictEqual(err, undefined);
                done();
            });
        });
    });
});
