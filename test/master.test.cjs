// @ts-nocheck
const assert = require('assert');
const { EventEmitter } = require('events');

class MockWorker extends EventEmitter {
	constructor(pid) {
		super();
		this.sentMessages = [];
		this.killed = false;
		this.process = { pid };
		this.setMaxListeners = () => {};
	}

	send(message) {
		this.sentMessages.push(message);
	}

	kill() {
		this.killed = true;
	}
}

let pidCounter = 1000;
const createdWorkers = [];

const mockCluster = {
	fork: () => {
		const worker = new MockWorker(pidCounter += 100);
		createdWorkers.push(worker);
		return worker;
	},
	setupPrimary: () => {},
	on: () => {}
};

let outputEnded = false;
const writtenOutputs = [];
let outputStreamRef;

class MockOutputStream extends EventEmitter {
	constructor() {
		super();
		outputStreamRef = this;
	}

	write(data) {
		writtenOutputs.push(data);
	}

	end() {
		outputEnded = true;
		// intentionally do not emit 'finish' to prevent process.exit from being scheduled
	}
}

const mockLogger = {
	info: () => {}, warn: () => {}, error: () => {},
	verbose: () => {}, debug: () => {}, silly: () => {}
};

const mockRunModeFlags = new Map();

const mockConfig = {
	providers: [],
	workers: [
		{ workerType: 'http', threads: 2, workerGroup: 'httpGroup' },
		{ workerType: 'db', threads: 1 }
	]
};

before(async () => {
	const { default: esmock } = await import('esmock');

	const savedArgv1 = process.argv[1];
	const savedArgv2 = process.argv[2];
	const savedArgv3 = process.argv[3];

	process.argv[1] = '/home/aolse/code/performance-library/src/master.js';
	process.argv[2] = '__test__';
	process.argv[3] = undefined;

	await esmock('../src/master.js', {
		'cluster': mockCluster,
		'../src/utils/logger.js': { logger: mockLogger, bindWorkers: () => {} },
		'../src/run-mode.js': {
			parseRunMode: () => {},
			runModeFlags: mockRunModeFlags
		},
		'../src/outputs/csv.js': { CsvStream: MockOutputStream },
		'../src/outputs/json.js': { JsonStream: MockOutputStream },
		'../src/outputs/newrelic.js': { NewrelicStream: MockOutputStream },
		'../src/outputs/stdout.js': { StdoutStream: MockOutputStream },
	}, {
		'../scenarios/__test__.js': {
			default: mockConfig
		}
	});

	process.argv[1] = savedArgv1;
	process.argv[2] = savedArgv2;
	process.argv[3] = savedArgv3;
});

describe('master.js', () => {
	it('creates workers for each thread in worker configs', () => {
		// mockConfig has 2 http threads + 1 db thread = 3 workers
		assert.equal(createdWorkers.length, 3, 'should fork one process per thread');
	});

	it('sends init message to each worker with its config', () => {
		const initMessages = createdWorkers.map((w) => w.sentMessages.find((m) => m.type === 'init'));

		assert.ok(initMessages.every((m) => m != null), 'every worker should receive an init message');

		const httpWorkers = createdWorkers.filter((w) =>
			w.sentMessages.some((m) => m.type === 'init' && m.workerType === 'http')
		);
		const dbWorkers = createdWorkers.filter((w) =>
			w.sentMessages.some((m) => m.type === 'init' && m.workerType === 'db')
		);

		assert.equal(httpWorkers.length, 2);
		assert.equal(dbWorkers.length, 1);
	});

	it('writes response messages to the output stream', () => {
		const worker = createdWorkers[0];
		const before = writtenOutputs.length;

		worker.emit('message', { type: 'response', duration: 150, success: true });

		assert.equal(writtenOutputs.length, before + 1);
		assert.equal(writtenOutputs[writtenOutputs.length - 1].response.duration, 150);
		assert.equal(writtenOutputs[writtenOutputs.length - 1].response.success, true);
	});

	it('broadcast routes sub-messages to all members of the named worker group', () => {
		const [worker0, worker1, worker2] = createdWorkers;
		const before0 = worker0.sentMessages.length;
		const before1 = worker1.sentMessages.length;
		const before2 = worker2.sentMessages.length;

		worker0.emit('message', {
			type: 'broadcast',
			workerGroup: 'httpGroup',
			messages: [{ type: 'ping' }]
		});

		// both httpGroup members should receive the sub-message
		assert.equal(worker0.sentMessages.length, before0 + 1);
		assert.equal(worker1.sentMessages.length, before1 + 1);
		// db worker (not in group) should not receive it
		assert.equal(worker2.sentMessages.length, before2);
	});

	it('ends the output stream once all workers report done', () => {
		assert.equal(outputEnded, false, 'stream should not be ended before all workers finish');

		const [worker0, worker1, worker2] = createdWorkers;

		worker0.emit('message', { type: 'done' });
		assert.equal(outputEnded, false, 'stream should not end with workers still running');

		worker1.emit('message', { type: 'done' });
		assert.equal(outputEnded, false);

		worker2.emit('message', { type: 'done' });
		assert.equal(outputEnded, true, 'stream should end after the last worker finishes');
	});
});
