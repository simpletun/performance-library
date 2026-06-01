declare module 'mkdirp' {
	export function sync(path: string, opts?: { mode?: number }): string | undefined;
}

import { Writable } from 'stream';

export interface OtelStreamOptions {
	endpoint?: string;
	headers?: Record<string, string>;
	serviceName?: string;
	exportIntervalMs?: number;
	runId?: string;
	durationBuckets?: number[];
	bytesBuckets?: number[];
}

export class OtelStream extends Writable {
	constructor(resultsPath?: string, options?: OtelStreamOptions);
}
