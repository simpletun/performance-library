declare module 'mkdirp' {
	export function sync(path: string, opts?: { mode?: number }): string | undefined;
}
