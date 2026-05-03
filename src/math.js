const { forEach } = require('@foundation/js-iterators');

/**
 * Calculates a weighted average between 2 sets of sample size and mean
 * @example
 * //returns 7
 * combinedAverage(3, 2, 5, 10)
 *
 * @function combinedAverage
 * @param {number} sampleSize1 sample size 1
 * @param {number} mean1 mean from sample 1
 * @param {number} sampleSize2 sample size 2
 * @param {number} mean2 mean from sample 2
 *
 * @returns {number} weighted average
 */
export function combinedAverage (sampleSize1, mean1, sampleSize2, mean2) {
	if([...arguments].some(arg => typeof arg !== 'number')) {
		throw new Error('All parameters must be numbers');
	}

	if([...arguments].length !== 4) {
		throw new Error('4 parameters must be provided');
	}

	return (sampleSize1 * mean1 + sampleSize2 * mean2) / (sampleSize1 + sampleSize2);
}

/**
 * Calculates a combined standard deviation between 2 sets of sample size, mean, and standard deviation
 *
 * @function combinedSampleStandardDeviation
 * @param {number} sampleSize1 sample size 1
 * @param {number} mean1 mean from sample 1
 * @param {number} standardDeviation1 standard deviation from sample 1
 * @param {number} sampleSize2 sample size 2
 * @param {number} mean2 mean from sample 2
 * @param {number} standardDeviation2 standard deviation from sample 2
 *
 * @returns {number} weighted standard deviation
 */
export const combinedSampleStandardDeviation = (sampleSize1, mean1, standardDeviation1, mean2, sampleSize2, standardDeviation2 ) => {
	const newAverage = combinedAverage(sampleSize1, mean1, sampleSize2, mean2);

	if (! standardDeviation2) {
		return standardDeviation1;
	}

	const numerator = sampleSize1 * standardDeviation1 ** 2 + sampleSize2 * standardDeviation2 ** 2 + sampleSize1 * (mean1 - newAverage) ** 2 + sampleSize2 * (mean2 - newAverage) ** 2;
	const denominator = sampleSize1 + sampleSize2 - 1;

	return Math.sqrt(numerator / denominator);
};

/**
 * Calculates the mean of the data set
 * @example
 * // returns 2
 * getMean([1,2,3])
 *
 * @function mean
 * @param {Array.<Number>} data
 *
 * @returns {number} mean of the data
 */
export const mean = (data) => {
	if(data.length === 0) {
		throw new Error('Data was an empty array');
	}

	let sum = 0;

	forEach(data, num => {
		if(typeof num !== 'number') {
			throw new Error(`Encountered a ${typeof num} in the data array. Expected only numbers`);
		}

		sum += num;
	});

	return sum / data.length;
};

/**
 * Calculates the variance of the data set
 *
 * @function variance
 * @param {Array.<Number>} data
 * @param {Number} [mean = getMean(data)] Mean of the data set
 *
 * @return {Number} variance of the data set
 */
export const variance = (data, average = mean(data)) => {
	if(data.length === 0) {
		throw new Error('Data was an empty array');
	}

	let v = 0;

	forEach(data, num => {
		if(typeof num !== 'number') {
			throw new Error(`Encountered a ${typeof num} in the data array. Expected only numbers`);
		}

		v += (num - average) ** 2;
	});

	return v;
};

/**
 * Calculates the population standard deviation of a data set
 * @example
 * // returns 0
 * populationStandardDeviation([2,2,2])
 * @example
 * // returns 0.8165...
 * populationStandardDeviation([1,2,3])
 *
 * @function populationStandardDeviation
 * @param {Array.<Number>} data
 * @param {Number} [variance = variance(data)] Mean of the data set
 *
 * @return {Number} population standard deviation
 */
export const populationStandardDeviation = (data) => {
	const populationVariance = variance(data);

	return populationVariance === 0 ? 0 : Math.sqrt(populationVariance / data.length);
};

/**
 * Calculates the sample standard deviation of a data set
 * @example
 * // returns 0
 * sampleStandardDeviation([2,2,2])
 * @example
 * // returns 1
 * sampleStandardDeviation([1,2,3])
 *
 * @function sampleStandardDeviation
 * @param {Array.<Number>} data
 * @param {Number} variance
 *
 * @return {Number} sample standard deviation
 */
export const sampleStandardDeviation = (data) => {
	const sampleVariance = variance(data);

	return sampleVariance === 0 ? 0 : Math.sqrt(sampleVariance / (data.length - 1));
};

/**
 * Rounds a number to the nearest decimals
 * @example
 * // returns 3.14
 * round(3.1415926, 2)
 *
 * @function round
 * @param {number} value number that needs to be rounded
 * @param {number} decimals max number of decimals
 *
 * @return {number} number rounded to at most the specified number of decimals
 */
export const round = (value, decimals = 0) => {
	return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
};
