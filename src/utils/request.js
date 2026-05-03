import { http, https } from 'follow-redirects';
import { logger } from './logger';

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

		let connectTime;

		const onResponse = (res) => {
			const firstByteTime = Date.now();

			let body = '';

			res.on('data', (chunk) => {
				body += chunk;
			});

			res.on('end', () => {
				const duration = Date.now() - startTime;
				const success = res.statusCode < 400;

				logger.debug('HTTP Request', options);
				logger[success ? 'silly' : 'debug']('HTTP Response', {'Status': res.statusCode, 'Body': body});

				resolve({
					success,
					status: res.statusCode,
					startTime,
					duration,
					body,
					bytes: req.socket.bytesRead,
					sentBytes: req.socket.bytesWritten,
					error: success ? void 0 : body,
					latency: firstByteTime - startTime,
					connect: connectTime - startTime
				});
			});

		};

		const startTime = Date.now();
		const req = (ssl ? https : http).request(options, onResponse);

		req.on('socket', () => {
			req.socket.on('connect', () => {
				connectTime = Date.now();
			});
		});

		req.on('error', (error) => {
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
