
import { logger } from './utils/logger.js';
import { parseRunMode } from './run-mode.js';

import path from 'path';

const appDir = path.dirname(process.argv[1]);

let initialized = false;
/** @type {Record<string, Function[]>} */
const messageListeners = { };
/** @type {any[]} */
const pendingMessages = [];

/**
 * @type {{ runMode?: string, workerType?: string, provider?: string, server?: { hostname: string, port?: number, headers: Record<string, string>, ssl?: boolean }, okta?: { url: string, clientId: string, clientSecret: string, scopes: string[], user?: string, password?: string }, [key: string]: any }}
 */
export const config = { };

/** @param {number} [delay] */
export const shutdown = (delay) => {
	if (delay) {
		setTimeout(() => shutdown(), delay);
	}

	else {
		process.send?.({ type: 'done' });
	}
};

/**
 * @param {string} type
 * @param {Function} callback
 */
export const onMessage = (type, callback) => {
	if (! messageListeners[type]) {
		messageListeners[type] = [ ];
	}

	messageListeners[type].push(callback);
};

/**
 * @param {string} type
 * @param {any[]} data
 */
export const sendMessage = (type, ...data) => {
	process.send?.(Object.assign({ }, ...data, { type }));
};

/** @typedef {{ type: string, workerType?: string, provider?: string, runMode?: string, [key: string]: any }} WorkerMessage */

const dispatch = (/** @type {WorkerMessage} */ message) => {
	if (messageListeners[message.type]) {
		messageListeners[message.type].forEach((callback) => callback(message));
	}
};

process.on('message', async (/** @type {WorkerMessage} */ message) => {
	if (message.type === 'init') {
		if (initialized) {
			throw new Error('Attempted to initialize worker twice');
		}

		Object.assign(config, message);
		parseRunMode(config.runMode);

		if(!message.provider){
			logger.verbose('New worker spawned', { type: message.workerType, pid: process.pid });
			await import(`${appDir}/workers/${message.workerType}.js`);
		}
		else {
			logger.verbose('New provider spawned', { type: message.workerType, pid: process.pid });
			await import(`./providers/${message.workerType}.js`);
		}

		initialized = true;
		pendingMessages.splice(0).forEach(dispatch);
		return;
	}

	if (!initialized) {
		pendingMessages.push(message);
		return;
	}

	dispatch(message);
});
