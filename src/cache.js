export const cache = (ttl) => ({
	set (key, value) {
		this[key] = value;
		setTimeout(() => delete this[key], ttl);

		return this;
	}
});
