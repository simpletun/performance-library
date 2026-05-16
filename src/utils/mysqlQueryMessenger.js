/*
This class simplifies using the mysql-data-provider worker type when asynchronously requesting queries
from a db connection pool.
Parameters -
	workerGroup - defines which group of mysql-data-providers will get the request.  That in turn
controls which host and db to which a query is sent.
	responseType - must be unique per worker/MysqlQueryMessenger combo, as this will define the worker's
event listener for reacting to the query read response.  These are defaulted, and normally an override
is not required.
*/
import { onMessage, sendMessage } from '../worker.js';
import { logger } from './logger.js';

const props = new WeakMap();

let nextQueryId = 0;

export class MysqlQueryMessenger {
	/** @param {{ workerGroup: string, responseType?: string }} options */
	constructor({ workerGroup, responseType = workerGroup + '_response' }) {
		const promises = new Map();

		// Add listener for dbResult object type
		onMessage(responseType, (/** @type {{ queryId: number, results: any }} */ dbResponseObject) => {
			logger.silly('Requester got db Response Message');

			if(props.get(this).promises.has(dbResponseObject.queryId)) {
				props.get(this).promises.get(dbResponseObject.queryId).resolve(dbResponseObject.results);
				props.get(this).promises.delete(dbResponseObject.queryId);
			}
		});

		props.set(this, {
			promises,
			workerGroup,
			responseType
		});
	}

	defer() {
		/** @type {{ data?: Promise<any>, resolve?: (value: any) => void, reject?: (reason?: any) => void }} */
		const deferred = { };

		deferred.data = new Promise((resolve, reject) => {
			deferred.resolve = resolve;
			deferred.reject = reject;
		});

		return deferred;
	};

	/** @param {string} queryString */
	async doQuery(queryString) {
		const _props = props.get(this);

		let queryId = ++nextQueryId;

		_props.promises.set(queryId, this.defer());

		const message = {
			type: 'dbQuery',
			query: queryString,
			from: process.pid,
			responseType: _props.responseType,
			queryId: queryId
		};

		sendMessage('roundrobin', {
			workerGroup: _props.workerGroup,
			message: message
		});

		const queryResponse = await _props.promises.get(queryId).data;

		return queryResponse;
	};
};

