const { cache } = require('./cache');
const stringify = require('json-stable-stringify');
const { map } = require('@foundation/js-iterators');

const serializeArgs = (args) => {
	return map(args, arg => stringify(arg)).join('\0\0');
};

export const cachedFunction = (ttl = 60000, f) => {
	const fCache = cache(ttl);

	return async (...args) => {
		const key = serializeArgs(args);

		if(!fCache[key]) {
			fCache.set(key, f(...args));
		}

		return fCache[key];
	};
};
