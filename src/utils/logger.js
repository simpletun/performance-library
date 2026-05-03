//TODO: Determine if we can use the ui test base logger or node-server-utils logger

import winston from 'winston';
import cluster from 'cluster';
import { ClusterTransport, bindClusterListeners } from '../transports/cluster-transport';
import { runModeFlags, whenRunModeLoaded } from '../run-mode';

// Create winston v3 logger with appropriate transports based on process type
const createLogger = () => {
	const formats = [
		// First, convert any object messages to JSON strings before other formatters see them
		winston.format((info) => {
			if (typeof info.message === 'object' && info.message !== null) {
				info.message = JSON.stringify(info.message);
			}
			return info;
		})(),
		winston.format.splat(), // This extracts additional arguments and merges object properties into info
		winston.format.colorize({ all: true }),
		winston.format.printf((info) => {
			const { level, message, timestamp, [Symbol.for('splat')]: splatArgs, ...meta } = info;
			const ts = timestamp ? `${timestamp} ` : '';

			// Collect metadata - splat() merges object properties directly into info
			const metaKeys = Object.keys(meta).filter(key =>
				key !== 'level' && key !== 'message' && key !== 'timestamp'
			);

			let metaStr = '';
			if (metaKeys.length > 0) {
				// Reconstruct the object from the unpacked properties
				const metaObj = {};
				metaKeys.forEach(key => {
					metaObj[key] = meta[key];
				});
				metaStr = ' ' + JSON.stringify(metaObj);
			}

			return `${ts}${level}: ${message}${metaStr}`;
		})
	];

	// Add timestamp format if requested
	if (runModeFlags.has('log:timestamp')) {
		formats.unshift(winston.format.timestamp());
	}

	const transports = [];

	if (cluster.isPrimary) {
		// Primary process: use Console transport
		transports.push(new winston.transports.Console({
			format: winston.format.combine(...formats)
		}));
	} else {
		// Worker process: use Cluster transport to send logs to primary
		transports.push(new ClusterTransport({
			format: winston.format.combine(...formats)
		}));
	}

	return winston.createLogger({
		levels: winston.config.npm.levels,
		level: 'info',
		transports
	});
};

export const logger = createLogger();

// Update log level when run mode is loaded
whenRunModeLoaded(() => {
	logger.level = runModeFlags.get('log') || 'info';
});

// Bind cluster listeners on primary process
export const bindWorkers = () => {
	if (cluster.isPrimary) {
		bindClusterListeners(logger);
	}
};
