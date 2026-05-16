/** @param {number} ttl */
export const cache = (ttl) => ({
	set (/** @type {string} */ key, /** @type {any} */ value) {
		const self = /** @type {Record<string, any>} */ (this);
		self[key] = value;
		setTimeout(() => delete self[key], ttl);

		return self;
	}
});
