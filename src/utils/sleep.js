
/** @param {number} ms */
export const sleep = (ms) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
