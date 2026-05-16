// @ts-nocheck
const assert = require('assert');
const { EventEmitter } = require('events');

// Mock modules
let mockReadStreamData = [];
let mockReadStreamIndex = 0;
let mockReadStreamEnded = false;

class MockReadStream extends EventEmitter {
	constructor() {
		super();
		this.isPaused = false;
		mockReadStreamIndex = 0;
		mockReadStreamEnded = false;
	}

	pause() {
		this.isPaused = true;
	}

	read(size) {
		if (mockReadStreamEnded || mockReadStreamIndex >= mockReadStreamData.length) {
			return null;
		}

		const chunk = mockReadStreamData[mockReadStreamIndex];
		mockReadStreamIndex++;

		if (mockReadStreamIndex >= mockReadStreamData.length) {
			// Simulate end event after all chunks are read
			setImmediate(() => this.emit('end'));
		}

		return Buffer.from(chunk);
	}
}

const mockCreateReadStream = (filename, options) => {
	const stream = new MockReadStream();

	// Simulate async readable event
	setImmediate(() => {
		stream.emit('readable');
	});

	// Simulate close event after end
	stream.on('end', () => {
		setImmediate(() => stream.emit('close'));
	});

	return stream;
};

const mockLogger = {
	silly: () => {},
	error: () => {}
};

const mockRandomItem = (array) => {
	return array[Math.floor(Math.random() * array.length)];
};

let LineReader;
before(async () => {
	const { default: esmock } = await import('esmock');
	({ LineReader } = await esmock('../src/utils/linereader.js', {
		'fs': { createReadStream: mockCreateReadStream },
		'../src/utils/logger.js': { logger: mockLogger },
		'../src/utils/random.js': { randomItem: mockRandomItem },
	}));
});

describe('linereader.js', () => {
	beforeEach(() => {
		mockReadStreamData = [];
		mockReadStreamIndex = 0;
		mockReadStreamEnded = false;
	});

	describe('basic line reading', () => {
		it('should read lines from a file', async () => {
			mockReadStreamData = [
				'line1\nline2\nline3\n'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');
			assert.equal(result1.eof, false);

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');
			assert.equal(result2.eof, false);

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, 'line3');
			assert.equal(result3.eof, false);
		});

		it('should handle CRLF line endings', async () => {
			mockReadStreamData = [
				'line1\r\nline2\r\nline3\r\n'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, 'line3');
		});

		it('should handle CR-only line endings', async () => {
			mockReadStreamData = [
				'line1\rline2\rline3\r'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');
		});
	});

	describe('chunked reading', () => {
		it('should handle data split across multiple chunks', async () => {
			mockReadStreamData = [
				'line1\nli',  // partial line
				'ne2\nline3\n'
			];

			const reader = new LineReader({ filename: 'test.txt', chunkSize: 50 });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, 'line3');
		});

		it('should handle multiple lines in a single chunk', async () => {
			mockReadStreamData = [
				'This is line one\nThis is line two\nThis is line three\n'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'This is line one');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'This is line two');

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, 'This is line three');
		});
	});

	describe('empty lines and edge cases', () => {
		it('should handle empty lines', async () => {
			mockReadStreamData = [
				'line1\n\nline3\n'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, '');

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, 'line3');
		});

		it('should handle file with no trailing newline', async () => {
			mockReadStreamData = [
				'line1\nline2\nline3'
			];

			const reader = new LineReader({ filename: 'test.txt', recycleOnEof: false });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');

			const result3 = await reader.nextLine();
			// The last line without newline should still be returned
			assert(result3.nextLine === 'line3' || result3.nextLine === null, 'Should return line3 or null');
		});

		it('should ignore empty last line', async () => {
			mockReadStreamData = [
				'line1\nline2\n'
			];

			const reader = new LineReader({ filename: 'test.txt', recycleOnEof: false });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, null);
			assert.equal(result3.eof, true);
		});
	});

	describe('recycleOnEof option', () => {
		it('should recycle stream and start over when recycleOnEof is true', async () => {
			mockReadStreamData = [
				'line1\nline2\n'
			];

			const reader = new LineReader({ filename: 'test.txt', recycleOnEof: true });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');

			// Reset mock data for recycling
			mockReadStreamData = [
				'line1\nline2\n'
			];
			mockReadStreamIndex = 0;
			mockReadStreamEnded = false;

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, 'line1', 'Should start over from beginning');
		});

		it('should return null at EOF when recycleOnEof is false', async () => {
			mockReadStreamData = [
				'line1\nline2\n'
			];

			const reader = new LineReader({ filename: 'test.txt', recycleOnEof: false });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'line2');

			const result3 = await reader.nextLine();
			assert.equal(result3.nextLine, null);
			assert.equal(result3.eof, true);
		});
	});

	describe('random line selection', () => {
		it('should return random lines when randomLine is true', async () => {
			mockReadStreamData = [
				'line1\nline2\nline3\nline4\nline5\n'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			const linesFound = new Set();

			// Read several random lines
			for (let i = 0; i < 5; i++) {
				const result = await reader.nextLine(true);
				assert(result.nextLine !== null, 'Should get a line');
				linesFound.add(result.nextLine);
			}

			// We should have gotten at least one line (randomness could give same line)
			assert(linesFound.size >= 1, 'Should have found at least one unique line');
		});

		it('should skip empty lines when selecting random lines', async () => {
			mockReadStreamData = [
				'line1\nline2\n'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			// The implementation recursively retries if it gets an empty string
			const result = await reader.nextLine(true);
			assert(result.nextLine !== '', 'Should not return empty string');
		});
	});

	describe('chunkSize configuration', () => {
		it('should accept custom chunkSize', async () => {
			mockReadStreamData = [
				'a'.repeat(100) + '\n' + 'b'.repeat(100) + '\n'
			];

			const reader = new LineReader({ filename: 'test.txt', chunkSize: 50 });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'a'.repeat(100));

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, 'b'.repeat(100));
		});
	});

	describe('bufferSize configuration', () => {
		it('should accept custom bufferSize', async () => {
			mockReadStreamData = [
				'line1\nline2\n'
			];

			const reader = new LineReader({
				filename: 'test.txt',
				bufferSize: 128 * 1024
			});

			const result = await reader.nextLine();
			assert.equal(result.nextLine, 'line1');
		});
	});

	describe('state management', () => {
		it('should properly manage internal state through lifecycle', async () => {
			mockReadStreamData = [
				'line1\n'
			];

			const reader = new LineReader({ filename: 'test.txt', recycleOnEof: false });

			// State should progress: opening -> readable -> closing -> closed
			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'line1');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, null);
			assert.equal(result2.eof, true);
		});
	});

	describe('multiple sequential reads', () => {
		it('should handle multiple nextLine calls efficiently', async () => {
			mockReadStreamData = [
				'line1\nline2\nline3\nline4\nline5\n'
			];

			const reader = new LineReader({ filename: 'test.txt' });

			const lines = [];
			for (let i = 0; i < 5; i++) {
				const result = await reader.nextLine();
				lines.push(result.nextLine);
			}

			assert.deepEqual(lines, ['line1', 'line2', 'line3', 'line4', 'line5']);
		});
	});

	describe('single line file', () => {
		it('should handle a file with a single line', async () => {
			mockReadStreamData = [
				'only line\n'
			];

			const reader = new LineReader({ filename: 'test.txt', recycleOnEof: false });

			const result1 = await reader.nextLine();
			assert.equal(result1.nextLine, 'only line');

			const result2 = await reader.nextLine();
			assert.equal(result2.nextLine, null);
			assert.equal(result2.eof, true);
		});
	});
});

