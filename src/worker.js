
import { logger } from './utils/logger';
import { parseRunMode } from './run-mode';

import path from 'path';

const appDir = path.dirname(require.main.filename);

let initialized = false;
const messageListeners = { };

export const config = { };

export const shutdown = (delay) => {
	if (delay) {
		setTimeout(() => shutdown(), delay);
	}

	else {
		process.send({ type: 'done' });
	}
};

export const onMessage = (type, callback) => {
	if (! messageListeners[type]) {
		messageListeners[type] = [ ];
	}

	messageListeners[type].push(callback);
};

export const sendMessage = (type, ...data) => {
	process.send(Object.assign({ }, ...data, { type }));
};

process.on('message', (message) => {
	if (message.type === 'init') {
		if (initialized) {
			throw new Error('Attempted to initialize worker twice');
		}

		Object.assign(config, message);
		parseRunMode(config.runMode);

		initialized = true;
		if(!message.provider){
			logger.verbose('New worker spawned', { type: message.workerType, pid: process.pid });
			require(`${appDir}/workers/${message.workerType}`);
		}
		else {
			logger.verbose('New provider spawned', { type: message.workerType, pid: process.pid });
			require(`./providers/${message.workerType}`);
		}
	}

	if (messageListeners[message.type]) {
		messageListeners[message.type].forEach((callback) => callback(message));
	}
});
