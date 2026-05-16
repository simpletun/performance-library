import { cache } from './cache.js';
import stringify from 'json-stable-stringify';

/** @param {any[]} args */
const serializeArgs = (args) => {
	return args.map(arg => stringify(arg)).join('\0\0');
};

/**
 * @param {(...args: any[]) => any} f
 * @param {number} [ttl]
 */
export const cachedFunction = (f, ttl = 60000) => {
	/** @type {Record<string, any> & { set(key: string, value: any): any }} */
	const fCache = cache(ttl);

	return async (/** @type {any[]} */ ...args) => {
		const key = serializeArgs(args);

		if(!(key in fCache)) {
			fCache.set(key, f(...args));
		}

		return fCache[key];
	};
};
