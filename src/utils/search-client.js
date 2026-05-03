/* eslint-disable no-bitwise */

import WebSocket from 'ws';
import { logger } from './logger';

const dirBit = 0x80;
const ackBit = 0x40;
const cosfBit = 0x20;
const noMetaBits = 0x1f;

const authType = 30;
const errorType = 31;

const uint8 = new Uint8Array(2);
const uint16 = new Uint16Array(uint8.buffer);

const uint16ToUint8 = (int) => {
	uint16[0] = int;

	return [ uint8[1], uint8[0] ];
};

const uint8ToUint16 = (byte0, byte1) => {
	uint8[0] = byte1;
	uint8[1] = byte0;

	return uint16[0];
};

export class SearchClient {
	constructor(proto, host, port, path) {
		logger.info(`${proto}://${host}:${port}${path}`);

		if (! port) {
			port = proto === 'wss' ? 443 : 80;
		}

		this.socket = new WebSocket(`${proto}://${host}:${port}${path}`, {
			rejectUnauthorized: false,
			timeout: 180000
		});

		this._nextId = 0;
		this._listeners = { };

		this.open = new Promise((resolve) => {
			this._onOpen = resolve;
		});

		this.ready = new Promise((resolve, reject) => {
			this._onReady = resolve;
			this._onError = reject;
		});

		this.closed = new Promise((resolve) => {
			this._onClosed = resolve;
		});

		this.socket.on('open', () => {
			logger.debug('Socket is Open!!!');
			this.isOpen = true;
			this._onOpen();
		});
		this.socket.on('close', (code, reason) => {
			logger.info('Socket closed', { code, reason });

			this.isOpen = false;

			if(this.resolveCurrentRequest){
				this.currentRequest.duration = Date.now() - this.currentRequest.startTime;
				this.resolveCurrentRequest(this.currentRequest);
			}

			this._onClosed();
		});
		this.socket.on('error', (error) => {
			this.giveError(error);

		});
		this.giveError = (error) => {
			logger.error(error);
			this.socket.close();
			this.isOpen = false;
			this._onError(error);
		};

		this.socket.on('message', (message) => this.onMessage(message));
	}

	formatMessage(messageId, type, body) {
		if (typeof body === 'object') {
			body = JSON.stringify(body);
		}

		if (typeof body === 'string') {
			body = Buffer.from(body, 'utf8');
		}

		const [ byte0, byte1 ] = uint16ToUint8(messageId);
		const byte2 = type | dirBit;

		return Buffer.from([ byte0, byte1, byte2, ...body ]);
	}

	parseMessageHeader(message) {
		const messageId = uint8ToUint16(message[0], message[1]);
		const dir = (message[2] & dirBit) === dirBit;
		const ack = (message[2] & ackBit) === ackBit;
		const cosf = (message[2] & cosfBit) === cosfBit;
		const type = message[2] & noMetaBits;

		return { messageId, dir, ack, cosf, type };
	}

	authenticate(token) {
		logger.debug('Authenticating Client...');
		const messageId = this._nextId++;
		const message = this.formatMessage(messageId, authType, token);

		if (this._nextId > 60000) {
			this._nextId = 0;
		}

		this._listeners[messageId] = (header) => {
			if (header.type === errorType) {
				this._onError('failed to authenticate');
				this._listeners[messageId] = null;
			}

			else if (header.ack) {
				logger.debug('Authentication Successful...Client is ready!');
				this.isReady = true;
				this._onReady();
				this._listeners[messageId] = null;
			}
		};

		this.socket.send(message);
	}

	onMessage(message) {
		logger.silly(`Got message of length -> ${message.length}`);
		const header = this.parseMessageHeader(message);

		// Ignore anything that's not a response to a client message
		if (header.dir) {
			// Ignore anything that's not waiting for a response
			if (this._listeners[header.messageId]) {
				this._listeners[header.messageId](header, message);
			}
		}
	}

	request(search) {
		return new Promise((resolve) => {
			const messageId = this._nextId++;

			if (this._nextId > 60000) {
				this._nextId = 0;
			}

			let error;
			let byteCount = 0;
			let messageCount = 0;
			const message = this.formatMessage(messageId, 2, search);
			const sentBytes = message.length;

			this._listeners[messageId] = (header, message) => {
				messageCount++;
				this.currentRequest.messageCount++;
				byteCount += message.length;
				this.currentRequest.byteCount += message.length;

				if (header.type === errorType) {
					error = message.slice(3).toString('utf8');
				}

				if (header.ack) {
					const duration = Date.now() - startTime;

					this._listeners[messageId] = null;

					this.resolveCurrentRequest = null;

					resolve({
						startTime,
						duration,
						status: error ? 500 : 200,
						success: ! error,
						error,
						bytes: byteCount,
						sentBytes,
						messageCount,
						// productCount: 0
					});
				}
			};

			this.resolveCurrentRequest = resolve;

			const startTime = Date.now();

			this.currentRequest = {
				startTime,
				byteCount: 0,
				messageCount: 0,
				status: 500,
				success: false,
				error: 'Unexpected Socket Close',
				sentBytes
			};

			logger.debug('Sending new request message over socket');

			this.socket.send(message);
		});
	}
}
