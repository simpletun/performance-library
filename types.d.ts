declare module 'mkdirp' {
	export function sync(path: string, opts?: { mode?: number }): string | undefined;
}

declare module 'csv-stringify' {
	import { Transform } from 'stream';

	interface StringifierOptions {
		header?: boolean;
		rowDelimiter?: string;
		columns?: string[];
	}

	export class Stringifier extends Transform {
		constructor(options?: StringifierOptions);
		write(chunk: any, encoding?: BufferEncoding, callback?: (error?: Error | null) => void): boolean;
	}
}
