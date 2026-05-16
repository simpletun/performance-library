/*
This class simplifies using the file-data-provider worker type when asynchronously requesting lines
from a read file.
Parameters -
	workerGroup - defines which group of file-data-providers will get the request.  That in turn
controls which file is being read.
	responseType - must be unique per worker/fileReadMessenger combo, as this will define the worker's
event listener for reacting to the file read response.
*/
import { shutdown, onMessage, sendMessage } from '../worker.js';
import { logger } from './logger.js';

/** @type {WeakMap<FileReadMessenger, { promises: Map<number, { data: Promise<any>, resolve: Function, reject: Function }>, workerGroup: string, responseType: string }>} */
const props = new WeakMap();

let nextRequestId = 0;

export class FileReadMessenger {
	/** @param {{ workerGroup: string, responseType?: string }} options */
	constructor({ workerGroup, responseType = workerGroup + '_response' }) {
		const promises = new Map();

		// Listener for eof event.  This would happen if we are not configured to recyle on eof.
		onMessage('eof', () => {
			logger.debug('Got eof message, shutting down.');
			shutdown();
		});

		// Listener for file responseType message, uniquely created for each fileReadMessenger instance, resolves promise with line
		onMessage(responseType, (/** @type {{ requestId: number, results: any }} */ readLine) => {
			logger.silly('Requester got file Response message');

			const _instanceProps = props.get(this);
			if(_instanceProps?.promises.has(readLine.requestId)) {
				_instanceProps.promises.get(readLine.requestId)?.resolve(readLine.results);
				_instanceProps.promises.delete(readLine.requestId);
			}
		});

		props.set(this, {
			promises,
			workerGroup,
			responseType
		});
	}

	defer() {
		/** @type {{ data: Promise<any>, resolve: Function, reject: Function }} */
		const deferred = /** @type {any} */ ({});

		deferred.data = new Promise((resolve, reject) => {
			deferred.resolve = resolve;
			deferred.reject = reject;
		});

		return deferred;
	};

	async getLine(random = false) {
		const _props = /** @type {NonNullable<ReturnType<typeof props.get>>} */ (props.get(this));

		let requestId = ++nextRequestId;

		_props.promises.set(requestId, this.defer());

		const message = {
			type: 'fileRead',
			from: process.pid,
			responseType: _props.responseType,
			requestId: requestId,
			random: random
		};

		sendMessage('roundrobin', {
			workerGroup: _props.workerGroup,
			message: message
		});

		const myLine = await _props.promises.get(requestId)?.data;

		return myLine;
	};
};

