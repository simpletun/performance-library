
import cluster from 'cluster';
import { logger, bindWorkers as bindLogger } from './utils/logger';
import { parseRunMode, runModeFlags } from './run-mode';
import { CsvStream } from './outputs/csv';
import { JsonStream } from './outputs/json';
import { NewrelicStream } from './outputs/newrelic';
import { StdoutStream } from './outputs/stdout';

import path from 'path';

const appDir = path.dirname(require.main.filename);

parseRunMode();

const outputType = runModeFlags.get('output') || 'csv';

const outputs = {
	csv: CsvStream,
	json: JsonStream,
	newrelic: NewrelicStream,
	stdout: StdoutStream
};

const scenario = process.argv[2];
const config = global.config = require(`${appDir}/../scenarios/${scenario}`);
const outputStream = new outputs[outputType](`${appDir}/results`);
const runMode = process.argv[3];

const results = [ ];
const workers = new Set();
const providers = new Set();
const workersByGroup = { };
const lastIndexByGroup = { };
const workersByType = { };
const workersByPid = { };

let shuttingDown, drainingProviders = false;

let lastProcessedIndex = 0;

const addToWorkerGroup = (worker, workerGroup) => {
	if (! workerGroup) {
		return;
	}

	if (Array.isArray(workerGroup)) {
		return workerGroup.forEach((workerGroup) => addToWorkerGroup(worker, workerGroup));
	}

	if (! workersByGroup[workerGroup]) {
		workersByGroup[workerGroup] = [ ];
		lastIndexByGroup[workerGroup] = 0;
	}

	workersByGroup[workerGroup].push(worker);
};

const waitingThreads = [ ];

if (runModeFlags.has('heap')) {
	cluster.setupMaster({
		execArgv: process.execArgv.concat([ `--max_old_space_size=${runModeFlags.get('heap')}` ])
	});
}

logger.info('Starting up worker threads...');

let totalThreads = 0;

const createWorker = (workerConfig, isProvider = false) => {
	const worker = cluster.fork();
	const { workerGroup, workerType } = workerConfig;

	worker.setMaxListeners(Infinity);
	if (! workersByType[workerType]) {
		workersByType[workerType] = new Set();
	}

	workersByType[workerType].add(worker);
	workersByPid[worker.process.pid] = worker;
	addToWorkerGroup(worker, workerGroup);

	if(!isProvider){
		totalThreads++;
		workers.add(worker);
	}
	else {
		providers.add(worker);
	}

	worker.send(Object.assign({ type: 'init', provider: isProvider }, workerConfig));

	worker.on('error', (e) => {
		logger.warn(`Caught an error ${e}`);
	});

	// eslint-disable-next-line no-loop-func
	worker.on('message', (message) => {
		switch (message.type) {
			case 'response':
				logger.silly('Worker message', message);

				outputStream.write({
					pid: worker.process.pid,
					response: message,
					workerType,
					hostname: workerConfig.server.hostname,
					totalThreads
				});

				results.push({
					duration: message.duration,
					success: message.success
				});

				break;

			case 'done':
				worker.kill();
				workersByType[workerType].delete(worker);
				delete workersByPid[worker.process.pid];

				if(!isProvider){
					totalThreads--;
					workers.delete(worker);
					logger.verbose('Worker finished', { pid: worker.process.pid });
				}
				else {
					providers.delete(worker);
					logger.verbose('Provider finished', { pid: worker.process.pid });
				}

				if (workerGroup) {
					const groupWorkers = workersByGroup[workerGroup];
					const workerIndex = groupWorkers.indexOf(worker);

					if (workerIndex >= 0) {
						groupWorkers.splice(workerIndex, 1);

						if (lastIndexByGroup[workerGroup] >= workerIndex) {
							lastIndexByGroup[workerGroup]--;
						}
					}
				}

				if (! workers.size) {
					if(providers.size){
						if(!drainingProviders){
							drainingProviders = true;
							providers.forEach((worker) => {
								worker.send({ type: 'stop' });
							});
						}
					}
					else {
						logger.info('Scenario complete', processResults(results));
						outputStream.on('finish', () => {
							logger.debug('Master Process is shutting down...');
							shuttingDown = true;
							setTimeout(() => process.exit(0), 1000);	// wrapping in setTimeout to fix IPC race condition
						});
						outputStream.end();
					}
				}

				break;

			case 'broadcast':
				const broadcastGroup = message.workerGroup ? workersByGroup[message.workerGroup] : worker;

				if (broadcastGroup) {
					broadcastGroup.forEach((worker) => {
						message.messages.forEach((subMessage) => {
							worker.send(subMessage);
						});
					});
				}

				else {
					logger.warn(`Worker group ${message.workerGroup} not found`);
				}

				break;

			case 'roundrobin':
				const roundrobinGroup = workersByGroup[message.workerGroup];

				const nextIndex = () => {
					if (lastIndexByGroup[message.workerGroup] >= roundrobinGroup.length) {
						lastIndexByGroup[message.workerGroup] = 0;
					}

					return lastIndexByGroup[message.workerGroup]++;
				};

				if (roundrobinGroup) {
					if (message.messages) {
						message.messages.forEach((subMessage) => {
							const index = nextIndex();
							const worker = roundrobinGroup[index];

							worker.send(subMessage);
						});
					}

					else {
						const index = nextIndex();
						const worker = roundrobinGroup[index];

						if(worker){
							worker.send(message.message || message);
						}
					}
				}

				else {
					logger.warn(`Worker group ${message.workerGroup} not found`);
				}

				break;

			case 'direct':
				if(message.message && message.to){
					const worker = workersByPid[message.to];

					if(worker){
						worker.send(message.message);
					}
				}

				break;

		}
	});

	return worker;
};

const createWorkers = (workerConfig, isProvider = false) => {
	const { threads, workerType } = workerConfig;

	if (typeof threads === 'number') {
		for (let i = 0; i < workerConfig.threads; i++) {
			createWorker(workerConfig, isProvider);
		}
	}

	else if (Array.isArray(threads)) {
		threads.forEach(({ startTime, count }) => {
			const threadConfig = Object.assign({ }, workerConfig);
			const startThread = () => {
				logger.debug('Starting new group of threads', { workerType, count });

				const newWorkers = [ ];

				for (let i = 0; i < count; i++) {
					newWorkers.push(createWorker(threadConfig, isProvider));
				}

				bindLogger();

				newWorkers.forEach((worker) => {
					worker.send({ type: 'start', waitTime: startTime });
					if(config.duration || config.scenario && config.scenario.duration){
						setTimeout(() => {
							worker.send({ type: 'stop' });
						}, (config.duration || config.scenario.duration) - startTime);
					}
				});
			};

			waitingThreads.push(() => {
				logger.debug('Setting timer to start new threads', { waitTime: startTime, workerType, count });
				setTimeout(startThread, startTime);
			});
		});
	}

	else {
		logger.error('Invalid "threads" value given for worker', workerConfig);
	}
};

config.providers.forEach((workerConfig) => {
	if (runModeFlags.has('single-thread')) {
		workerConfig.threads = 1;
		if (workerConfig.subThreads) {
			workerConfig.subThreads = 1;
		}
	}

	workerConfig.runMode = runMode;
	createWorkers(workerConfig, true);

	cluster.on('exit', (worker, code, signal) => handleExit(worker, code, signal));
});

config.workers.forEach((workerConfig) => {
	if (runModeFlags.has('single-thread')) {
		workerConfig.threads = 1;
		if(workerConfig.subThreads){
			workerConfig.subThreads = 1;
		}
	}

	workerConfig.runMode = runMode;
	createWorkers(workerConfig);

	cluster.on('exit', (worker, code, signal) => handleExit(worker, code, signal));
});

const handleExit = (worker, code, signal) => {
	if (workers.has(worker)) {
		logger.warn(`Worker ${worker.process.pid} died`, {
			code,
			signal
		});
		workers.delete(worker);
	}

	Object.keys(workersByGroup).forEach((workerGroup) => {
		const workers = workersByGroup[workerGroup];
		const workerIndex = workers.indexOf(worker);

		if (workerIndex >= 0) {
			workers.splice(workerIndex, 1);
		}
	});
};

bindLogger();

const runScenario = () => {
	logger.info(`Starting performance scenario "${scenario}"...`);

	workers.forEach((worker) => {
		worker.send({ type: 'start' });
		if(config.duration || config.scenario && config.scenario.duration){
			setTimeout(() => {
				worker.send({ type: 'stop' });
			}, config.duration || config.scenario.duration);
		}
	});

	waitingThreads.forEach((startThreadWait) => startThreadWait());

	setTimeout(processPartialResults, 5000);
};

const processResults = (results) => {
	if (! results.length) {
		const zero = '0ms';

		return {
			average: zero,
			min: zero,
			max: zero,
			average95: zero,
			max95: zero,
			count: results.length,
			successCount: 0,
			errorCount: 0
		};
	}

	let successCount = 0;
	let errorCount = 0;

	const durations = [ ];

	results.forEach((result) => {
		durations.push(result.duration);

		if (result.success) {
			successCount++;
		}
		else {
			errorCount++;
		}
	});

	durations.sort();

	const stats = getStats(durations);
	const stats95 = getStats(durations.slice(0, Math.floor(durations.length * 0.95)));

	return {
		average: `${stats.roundedAverage}ms`,
		min: `${stats.min}ms`,
		max: `${stats.max}ms`,
		average95: `${stats95.roundedAverage}ms`,
		max95: `${stats95.max}ms`,
		count: results.length,
		successCount,
		errorCount
	};
};

const processPartialResults = () => {
	if(!shuttingDown){
		const segment = results.slice(lastProcessedIndex);

		lastProcessedIndex = results.length;

		logger.info(processResults(segment));

		setTimeout(processPartialResults, 5000);
	}
};

const getStats = (numbers) => {
	const sum = numbers.reduce((a, b) => a + b, 0);
	const average = sum / numbers.length;
	const roundedAverage = Math.round(average * 100) / 100;
	const { min, max } = getMinMax(numbers);

	return { average, roundedAverage, max, min };
};

const getMinMax = (arr) => {
	let len = arr.length;
	let max = -Infinity;
	let min = Infinity;

	while (len--) {
		max = arr[len] > max ? arr[len] : max;
		min = arr[len] < min ? arr[len] : min;
	}

	return {min, max};
};

setTimeout(runScenario, 1000);
