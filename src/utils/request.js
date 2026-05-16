import followRedirects from 'follow-redirects';
const { http, https } = /** @type {any} */ (followRedirects);
import { logger } from './logger.js';

/**
 * @param {{ method: string, headers: Record<string, string>, path: string, payload?: string, hostname: string, port?: number, ssl?: boolean }} options
 */
export const request = ({ method, headers, path, payload, hostname, port, ssl }) => {
	return new Promise((resolve) => {
		const options = {
			hostname,
			method,
			path,
			headers,
			port: port || (ssl ? 443 : 80),
			rejectUnauthorized: false
		};

		/** @type {number | undefined} */
		let connectTime;

		const startTime = Date.now();

		/** @param {import('http').IncomingMessage} res */
		const onResponse = (res) => {
			const firstByteTime = Date.now();

			let body = '';

			res.on('data', (chunk) => {
				body += chunk;
			});

			res.on('end', () => {
				const duration = Date.now() - startTime;
				const success = !!res.statusCode && res.statusCode < 400;

				logger.debug('HTTP Request', options);
				logger[success ? 'silly' : 'debug']('HTTP Response', {'Status': res.statusCode, 'Body': body});

				resolve({
					success,
					status: res.statusCode,
					startTime,
					duration,
					body,
					bytes: req.socket?.bytesRead,
					sentBytes: req.socket?.bytesWritten,
					error: success ? void 0 : body,
					latency: firstByteTime - startTime,
					connect: connectTime ? connectTime - startTime : void 0
				});
			});

		};

		const req = (ssl ? https : http).request(options, onResponse);

		req.on('socket', () => {
			req.socket.on('connect', () => {
				connectTime = Date.now();
			});
		});

		req.on('error', (/** @type {Error} */ error) => {
			logger.debug('HTTP Request', options);
			logger.warn(error);

			resolve({
				success: false,
				status: 0,
				startTime,
				endTime: Date.now(),
				error: error.message,
				connect: connectTime ? connectTime - startTime : void 0
			});
		});

		if (payload && method !== 'GET' && method !== 'HEAD') {
			req.useChunkedEncodingByDefault = true;
			req.write(payload);
		}

		req.end();
	});
};
