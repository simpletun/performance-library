
import { logger } from './utils/logger.js';

let loaded = false;

export const runModeFlags = new Map();

export const parseRunMode = (runMode = process.argv[3]) => {
	loaded = true;

	(runMode || '').split(',').forEach((flag) => {
		const [ setting, value ] = flag.split(':');

		runModeFlags.set(setting, value == null ? true : value);
	});

	if (runModeFlags.has('log')) {
		logger.level = runModeFlags.get('log');
	}

	callbacks.forEach((callback) => callback());
};

/** @type {(() => void)[]} */
const callbacks = [ ];

/** @param {() => void} callback */
export const whenRunModeLoaded = (callback) => {
	if (loaded) {
		callback();
	}

	else {
		callbacks.push(callback);
	}
};
