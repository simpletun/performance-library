
import { randomNumberFrom } from './random.js';
import { sleep } from './sleep.js';

/**
 * @param {number} from
 * @param {number} to
 */
export const uniformThinkTime = (from, to) => {
	return sleep(randomNumberFrom(from, to));
};

// Box-Muller transform: produces a standard normal sample (mean=0, stddev=1)
const gaussianSample = () => {
	let u, v;
	do {
		u = Math.random();
		v = Math.random();
	} while (u === 0);
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * @param {number} from
 * @param {number} to
 */
export const gaussianThinkTime = (from, to) => {
	const mean = (from + to) / 2;
	const deviation = (to - from) / 6;
	const ms = Math.min(to, Math.max(from, Math.round(gaussianSample() * deviation + mean)));
	return sleep(ms);
};
