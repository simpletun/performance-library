
import { randomBytes } from 'crypto';

/**
 * @param {number} min
 * @param {number} max
 */
export const randomInt = (min, max) => {
	return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * @param {number} min
 * @param {number} max
 */
export const randomNumberFrom = (min, max) => {
	return randomInt(min, max + 1);
};

/** @param {number} percent */
export const checkPercent = (percent) => {
	return randomInt(0, 100) < percent;
};

export const coinFlip = () => checkPercent(50);

/** @param {any[]} array */
export const randomItem = (array) => {
	return array[randomInt(0, array.length)];
};

/**
 * @param {any[]} array
 * @param {number} [min]
 * @param {number} [max]
 */
export const randomItems = (array, min, max) => {
	const count = randomInt(min || 0, max || array.length);

	let subArray = array.slice();

	while (subArray.length > count) {
		subArray.splice(randomInt(0, subArray.length), 1);
	}

	return subArray;
};

/**
 * @param {string} str
 * @param {number} [min]
 * @param {number} [max]
 */
export const randomSubString = (str, min, max) => {
	const stringSize = randomNumberFrom(min || 0, max || str.length);
	const startIndex = randomNumberFrom(0, str.length - stringSize);

	return str.substring(startIndex, startIndex + stringSize);
};

/** @param {any[][]} arrays */
export const randomItemWeightedEven = (...arrays) => {
	return randomItem(arrays[randomInt(0, arrays.length)]);
};

/** @param {{ weight: number, array: any[] }[]} arraysWithWeight */
export const randomItemWeightedArray = (...arraysWithWeight) => {
	const chosenObject = randomObjectWeighted(...arraysWithWeight);

	return randomItem(chosenObject.array);
};

/** @param {{ weight: number, range: { min: number, max: number } }[]} rangesWithWeight */
export const randomIntWeightedRange = (...rangesWithWeight) => {
	const chosenObject = randomObjectWeighted(...rangesWithWeight);

	return randomInt(chosenObject.range.min, chosenObject.range.max) || 0;
};

/** @param {{ weight: number, [key: string]: any }[]} objectsWithWeight */
export const randomObjectWeighted = (...objectsWithWeight) => {
	/** @type {{ weight: number, [key: string]: any }[]} */
	const objects = [ ];
	/** @type {number[]} */
	const weights = [ ];

	let totalWeight = 0;

	objectsWithWeight.forEach((theObject) => {
		objects.push(theObject);
		weights.push(totalWeight + theObject.weight);
		totalWeight += theObject.weight;
	});

	const chosenWeight = randomInt(0, totalWeight);

	const chosenObject = objects.find((array, index) => {
		return chosenWeight < weights[index];
	});

	return /** @type {NonNullable<typeof chosenObject>} */ (chosenObject);
};

/**
 * @param {number} count
 * @param {string} [chars]
 */
export const randomCharacters = (count, chars = 'abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789') => {
	const random = randomBytes(count);
	const result = new Array(count);
	const charCount = chars.length;

	for (let i = 0; i < count; i++) {
		result[i] = chars[random[i] % charCount];
	}

	return result.join('');
};
