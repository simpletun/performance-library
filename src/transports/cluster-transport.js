import Transport from 'winston-transport';
import cluster from 'cluster';

/**
 * Custom Winston v3 transport for cluster communication
 * Replaces the abandoned winston-cluster package
 */
export class ClusterTransport extends Transport {
	constructor(opts = {}) {
		super(opts);
	}

	/**
	 * @param {Record<string | symbol, any>} info
	 * @param {() => void} callback
	 */
	log(info, callback) {
		setImmediate(() => {
			this.emit('logged', info);
		});

		// Send log message to primary process via IPC
		if (cluster.isWorker && process.send) {
			// Use the raw level (Symbol.for('level')) to avoid sending colorized level strings
			const rawLevel = info[Symbol.for('level')] || info.level;

			// Collect all metadata from info object (excluding winston internal properties)
			/** @type {Record<string, any>} */
			const meta = {};
			const excludeKeys = ['level', 'message', 'timestamp'];
			for (const key in info) {
				if (!excludeKeys.includes(key) && typeof key === 'string' && !key.startsWith('Symbol')) {
					meta[key] = info[key];
				}
			}

			process.send({
				type: 'log',
				level: rawLevel,
				message: info.message,
				meta: meta,
				timestamp: info.timestamp
			});
		}

		callback();
	}
}

/**
 * Bind listener on primary process to receive logs from workers
 */
/** @param {{ log: (info: Record<string, any>) => void }} logger */
export function bindClusterListeners(logger) {
	if (!cluster.isPrimary) {
		return;
	}

	cluster.on('message', (worker, message) => {
		if (message && message.type === 'log') {
			// Log the message from worker on the master logger
			logger.log({
				level: message.level,
				message: message.message,
				...message.meta
			});
		}
	});
}

