const assert = require('assert');
const { sleep } = require('../src/utils/sleep');

describe('sleep.js', () => {
	describe('sleep', () => {
		it('should resolve after the specified milliseconds', async () => {
			const ms = 100;
			const startTime = Date.now();

			await sleep(ms);

			const endTime = Date.now();
			const elapsed = endTime - startTime;

			// Allow some tolerance for timer precision (±20ms)
			assert(elapsed >= ms - 20, `Should sleep at least ${ms}ms, but only slept ${elapsed}ms`);
			assert(elapsed < ms + 50, `Should not sleep much longer than ${ms}ms, but slept ${elapsed}ms`);
		});

		it('should work with zero milliseconds', async () => {
			const startTime = Date.now();

			await sleep(0);

			const endTime = Date.now();
			const elapsed = endTime - startTime;

			// Should resolve almost immediately
			assert(elapsed < 20, `Should resolve quickly, but took ${elapsed}ms`);
		});

		it('should return a Promise', () => {
			const result = sleep(10);

			assert(result instanceof Promise, 'sleep should return a Promise');
		});

		it('should resolve without a value', async () => {
			const result = await sleep(10);

			assert.equal(result, undefined, 'sleep should resolve with undefined');
		});

		it('should work with multiple concurrent sleeps', async () => {
			const startTime = Date.now();

			// Start multiple sleeps concurrently
			const promises = [
				sleep(50),
				sleep(50),
				sleep(50)
			];

			await Promise.all(promises);

			const endTime = Date.now();
			const elapsed = endTime - startTime;

			// All should complete around the same time (not sequentially)
			assert(elapsed < 100, `Concurrent sleeps should complete together, took ${elapsed}ms`);
			assert(elapsed >= 30, `Should take at least 50ms (with tolerance), took ${elapsed}ms`);
		});

		it('should work with different durations', async () => {
			const durations = [10, 50, 100];

			for (const duration of durations) {
				const startTime = Date.now();
				await sleep(duration);
				const elapsed = Date.now() - startTime;

				assert(elapsed >= duration - 20, `Sleep(${duration}) should wait at least ${duration}ms, waited ${elapsed}ms`);
			}
		});

		it('should handle large values', async () => {
			const startTime = Date.now();

			// Use a larger value but still reasonable for testing
			await sleep(200);

			const elapsed = Date.now() - startTime;

			assert(elapsed >= 180, `Should wait at least 200ms (with tolerance), waited ${elapsed}ms`);
			assert(elapsed < 250, `Should not wait much longer than 200ms, waited ${elapsed}ms`);
		});
	});
});

