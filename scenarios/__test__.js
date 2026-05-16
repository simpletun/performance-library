export default {
	providers: [],
	workers: [
		{ workerType: 'http', threads: 2, workerGroup: 'httpGroup' },
		{ workerType: 'db', threads: 1 }
	]
};
