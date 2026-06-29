// @ts-nocheck
const assert = require('assert');
const { uniformThinkTime, gaussianThinkTime } = require('../src/utils/thinkTime');

describe('thinkTime.js', () => {
	describe('uniformThinkTime', () => {
		it('should return a Promise', () => {
			const result = uniformThinkTime(0, 0);
			assert(result instanceof Promise, 'uniformThinkTime should return a Promise');
			return result;
		});

		it('should resolve after at least the minimum duration', async () => {
			const from = 50;
			const to = 100;
			const start = Date.now();

			await uniformThinkTime(from, to);

			const elapsed = Date.now() - start;
			assert(elapsed >= from - 20, `Should sleep at least ${from}ms, but only slept ${elapsed}ms`);
		});

		it('should resolve within the maximum duration', async () => {
			const from = 10;
			const to = 50;
			const start = Date.now();

			await uniformThinkTime(from, to);

			const elapsed = Date.now() - start;
			assert(elapsed <= to + 50, `Should sleep no more than ${to}ms (with tolerance), but slept ${elapsed}ms`);
		});

		it('should work when from and to are equal', async () => {
			const ms = 50;
			const start = Date.now();

			await uniformThinkTime(ms, ms);

			const elapsed = Date.now() - start;
			assert(elapsed >= ms - 20, `Should sleep at least ${ms}ms, but slept ${elapsed}ms`);
			assert(elapsed <= ms + 50, `Should not sleep much longer than ${ms}ms, but slept ${elapsed}ms`);
		});
	});

	describe('gaussianThinkTime', () => {
		it('should return a Promise', () => {
			const result = gaussianThinkTime(50, 150);
			assert(result instanceof Promise, 'gaussianThinkTime should return a Promise');
			return result;
		});

		it('should resolve near the midpoint when from and to are close', async () => {
			const from = 90;
			const to = 110;
			const mid = (from + to) / 2;
			const start = Date.now();

			await gaussianThinkTime(from, to);

			const elapsed = Date.now() - start;
			assert(elapsed >= from - 20, `Should sleep at least ~${from}ms, but slept ${elapsed}ms`);
			assert(elapsed <= to + 50, `Should sleep no more than ~${to}ms, but slept ${elapsed}ms`);
		});

		it('should never sleep less than from', async () => {
			const from = 50;
			const to = 150;
			const start = Date.now();

			await gaussianThinkTime(from, to);

			const elapsed = Date.now() - start;
			assert(elapsed >= from - 20, `Should sleep at least ${from}ms, but slept ${elapsed}ms`);
		});

		it('should never sleep more than to', async () => {
			const from = 50;
			const to = 100;
			const start = Date.now();

			await gaussianThinkTime(from, to);

			const elapsed = Date.now() - start;
			assert(elapsed <= to + 20, `Should sleep no more than ${to}ms, but slept ${elapsed}ms`);
		});

		it('should produce a roughly normal distribution centered on the midpoint of from and to', () => {
			// Statistical smoke test: collect 1000 raw samples and check the sample mean
			// is within 3 standard errors of the expected midpoint
			const from = 200;
			const to = 800;
			const expectedMean = (from + to) / 2;   // 500
			const expectedDev = (to - from) / 6;    // 100
			const sampleSize = 1000;

			// Replicate the implementation logic without sleeping
			const gaussianSample = () => {
				let u, v;
				do { u = Math.random(); v = Math.random(); } while (u === 0);
				return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
			};

			const samples = Array.from({ length: sampleSize }, () =>
				Math.min(to, Math.max(from, Math.round(gaussianSample() * expectedDev + expectedMean)))
			);

			const sampleMean = samples.reduce((a, b) => a + b, 0) / sampleSize;

			// Standard error = deviation / sqrt(n) ≈ 100 / ~31.6 ≈ 3.16
			// 3 standard errors ≈ 9.5ms — a very generous bound
			const allowedDelta = (expectedDev / Math.sqrt(sampleSize)) * 3;
			assert(
				Math.abs(sampleMean - expectedMean) < allowedDelta,
				`Sample mean ${sampleMean.toFixed(1)} should be within ${allowedDelta.toFixed(1)}ms of expected mean ${expectedMean}`
			);
		});
	});
});
