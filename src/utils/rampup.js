
export const evenRampUp = (threadCount, rampTime, groupSize = 1) => {
	const threadsArray = [];
	const threadGroups = Math.ceil(threadCount / groupSize); // 34 / 10 = 4
	const threadDelay = Math.floor(rampTime / (threadGroups - 1)); // 60000 / 3 = 20000

	for(let i = 0; i < threadGroups; i++){ // 2
		let remainder = threadCount - groupSize * i; // 34 - 10 * 1 = 4

		threadsArray.push({
			startTime: i * threadDelay,
			count: groupSize > remainder ? remainder : groupSize
		});
	}

	return threadsArray;
};