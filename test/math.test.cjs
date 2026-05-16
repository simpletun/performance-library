// @ts-nocheck
const assert = require('assert');

const { combinedAverage, combinedSampleStandardDeviation, mean, populationStandardDeviation, round, sampleStandardDeviation, variance } = require('../src/math');

describe('Mocha works', () => {
	it('should pass this test', () => {
		assert(true);
	});
});

describe('math.js', () => {
	describe('combinedAverage', () => {

		const testData = [
			{it: 'should return the combined average from two samples', sampleSize1: 5, mean1: 5, sampleSize2: 5, mean2: 15, expected: 10, assertionErrorText: 'happy path failed'},
			{it: 'should return the first sample\'s average if the sample size 2 is 0', sampleSize1: 8, mean1: 2, sampleSize2: 0, mean2: 10, expected: 2, assertionErrorText: 'should have returned the mean of the first sample when the second sample size was 0'},
			{it: 'should successfully accept a zero mean for the second sample', sampleSize1: 8, mean1: 2, sampleSize2: 2, mean2: 0, expected: 1.6, assertionErrorText: 'should have returned the mean of the first sample when the second sample size was 0'},
		];

		const errorTests = [
			{it: 'should throw an error when a parameter is undefined', sampleSize1: undefined, mean1: 5, sampleSize2: 5, mean2: 15, assertionErrorText: 'No error was thrown for undefined parameter'},
			{it: 'should throw an error when a parameter is not a number', sampleSize1: '8', mean1: 2, sampleSize2: 0, mean2: 10, assertionErrorText: 'No error was thrown when a string was passed'}
		];

		testData.forEach(test => {
			it(test.it, () => {
				const actual = combinedAverage(test.sampleSize1, test.mean1, test.sampleSize2, test.mean2);

				assert.equal(test.expected, actual, test.assertionErrorText);
			});
		});

		errorTests.forEach(test => {
			it(test.it, () => {
				assert.throws(() => combinedAverage(test.sampleSize1, test.mean1, test.sampleSize2, test.mean2), Error, test.assertionErrorText);
			});
		});

		it('should throw an error the number of parameters was not 4', () => {
			assert.throws(() => combinedAverage(1,2,3), Error, 'should have returned the mean of the first sample when the second sample size was 0');
		});

	});

	describe('mean', () => {

		const testData = [
			{it: 'should successfully calculate the mean of a number array', data: [1,2,3], expected: 2, assertionErrorText: 'Incorrect mean calculated'},
		];

		const errorTests = [
			{it: 'should throw an error if passed an empty array', data: [], assertionErrorText: 'Expected an error for an empty array'},
			{it: 'should throw an error if passed a non-number in the array', data: [1,'2', 3], assertionErrorText: 'Expected an error thrown since a string was present'}
		];

		testData.forEach(test => {
			it(test.it, () => {
				assert.equal(mean(test.data), test.expected, test.assertionErrorText);
			});
		});

		errorTests.forEach(test => {
			it(test.it, () => {
				assert.throws(() => mean(test.data), Error, test.assertionErrorText);
			});
		});

	});

	describe('combinedSampleStandardDeviation', () => {

		const testData = [
			{it: 'should successfully combine two sample standard deviations', sampleSize1: 10, mean1: 2, standardDeviation1: 1, sampleSize2: 5, mean2: 3, standardDeviation2: 2, expected: 1.89}
		];

		testData.forEach(test => {
			it(test.it, () => {

				const actual = combinedSampleStandardDeviation(test.sampleSize1, test.mean1, test.standardDeviation1, test.sampleSize2, test.mean2, test.standardDeviation2);

				assert(Math.abs(actual - test.expected) <= .01, assertionFailureText('Incorrect combinedSampleStandardDeviation', test.expected, actual));
			});
		});

	});

	describe('variance', () => {

		const testData = [
			{it: 'should successfully calculate variance if an array and mean are provided', data: [1,2,3], mean: 2, expected: 2},
			{it: 'should successfully calculate variance if an array and mean are provided', data: [1,2,3,4,5], mean: 3, expected: 10},
			{it: 'should successfully calculate variance if an array with negative values and mean are provided', data: [-1,2,-4], mean: -1, expected: 18},
			{it: 'should successfully calculate variance if an array, but no mean is provided', data: [0,2,4], expected: 8}
		];

		const errorTests = [
			{it: 'should throw an error if passed an empty array', data: [], mean: 0, assertionErrorText: 'Expected an error for an empty array'},
			{it: 'should throw an error if passed a non-number in the array', data: [1,'2', 3], mean: 2, assertionErrorText: 'Expected an error thrown since a string was present'}
		];

		testData.forEach(test => {
			it(test.it, () => {

				const actual = variance(test.data, test.mean);

				assert(Math.abs(actual - test.expected) <= .01, assertionFailureText('Incorrect variance', test.expected, actual));

			});
		});

		errorTests.forEach(test => {
			it(test.it, () => {
				assert.throws(() => variance(test.data, test.mean), Error, test.assertionErrorText);
			});
		});

	});

	describe('sampleStandardDeviation', () => {

		const testData = [
			{it: 'should successfully calculate standard deviation of a number array.', data: [1,2,3], expected: 1}
		];

		testData.forEach(test => {
			it(test.it, () => {
				const actual = sampleStandardDeviation(test.data);

				assert(Math.abs(actual - test.expected) <= .01, assertionFailureText('Incorrect sampleStandardDeviation', test.expected, actual));

			});
		});

	});

	describe('populationStandardDeviation', () => {

		const testData = [
			{it: 'should successfully calculate standard deviation of a number array.', data: [2,2,6,6], expected: 2}
		];

		testData.forEach(test => {
			it(test.it, () => {
				const actual = populationStandardDeviation(test.data);

				assert(Math.abs(actual - test.expected) <= .01, assertionFailureText('Incorrect populationStandardDeviation', test.expected, actual));

			});
		});

	});

	describe('round', () => {

		const testData = [
			{it: 'should successfully round to n decimal places', number: 3.14159, decimals: 2, expected: 3.14, assertionErrorText: 'Did not successfully round pi to 2 places'},
			{it: 'should remove trailing zeroes', number: 3.1000, decimals: 3, expected: 3.1, assertionErrorText: 'Did not remove trailing zeroes'},
			{it: 'should round to the nearest whole number', number: 3.5, decimals: 0, expected: 4, assertionErrorText: 'Did not successfully round up'},
		];

		testData.forEach(test => {
			it(test.it, () => {
				const actual = round(test.number, test.decimals);

				assert(actual === test.expected, assertionFailureText(test.assertionErrorText, test.expected, actual));
			});
		});

	});
});

const assertionFailureText = (text, expected, actual) => {
	return `${text} \nExpected: ${expected}\nActual: ${actual}`;
};
