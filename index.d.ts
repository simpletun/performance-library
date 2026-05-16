import type { Writable } from 'stream';
import type { Logger } from 'winston';

// ─── Output Streams ───────────────────────────────────────────────────────────

export class CsvStream extends Writable {
	constructor(outputDirectory: string);
}

export class JsonStream extends Writable {
	constructor(outputDirectory: string);
}

export interface NewrelicOptions {
	accountId?: string | number;
	insertKey?: string;
}

export class NewrelicStream extends Writable {
	constructor(options?: NewrelicOptions);
}

export interface InfluxDbOptions {
	url?: string;
	token?: string;
	org?: string;
	bucket?: string;
}

export class InfluxDbStream extends Writable {
	constructor(options?: InfluxDbOptions);
}

export class StdoutStream extends Writable {
	constructor();
}

// ─── Data Messengers ──────────────────────────────────────────────────────────

export interface MessengerOptions {
	workerGroup: string;
	responseType?: string;
}

export class FileReadMessenger {
	constructor(options: MessengerOptions);
	getLine(random?: boolean): Promise<any>;
}

export class MysqlQueryMessenger {
	constructor(options: MessengerOptions);
	doQuery(queryString: string): Promise<any>;
}

// ─── LineReader ───────────────────────────────────────────────────────────────

export interface LineReaderOptions {
	fileName: string;
	chunkSize?: number;
	bufferSize?: number;
	recycleOnEof?: boolean;
}

export class LineReader {
	constructor(options: LineReaderOptions);
	nextLine(randomLine?: boolean): Promise<{ nextLine: string | null; eof: boolean }>;
}

// ─── HTTP Utilities ───────────────────────────────────────────────────────────

export interface RequestConfig {
	hostname?: string;
	port?: number;
	path: string;
	method?: string;
	headers?: Record<string, string>;
	ssl?: boolean;
	payload?: string | Buffer;
}

export interface RequestResult {
	startTime: number;
	duration: number;
	status: number;
	success: boolean;
	body: string;
	error: string;
	bytes: number;
	sentBytes: number;
	connect: number;
	latency: number;
}

export function request(config: RequestConfig): Promise<RequestResult>;

export interface MakeRequestOptions {
	transactionName: string;
	requestConfig: RequestConfig;
	parseField?: string;
	returnBody?: boolean;
	ignoreError?: boolean;
	ignoredCodes?: number[];
	trackRequest?: boolean;
}

export interface MakeRequestResult {
	status: number;
	body?: string;
	parsedValue?: any;
}

export function makeRequest(options: MakeRequestOptions): Promise<MakeRequestResult>;

// ─── Worker Lifecycle ─────────────────────────────────────────────────────────

export const config: Record<string, any>;
export function shutdown(): void;
export function onMessage(event: string, handler: (data: any) => void): void;
export function sendMessage(type: string, data?: any): void;

// ─── MySQL ────────────────────────────────────────────────────────────────────

export interface MysqlConnectionConfig {
	host: string;
	user: string;
	password: string;
	database: string;
	connectionLimit?: number;
	[key: string]: any;
}

export interface MysqlPoolConfig {
	master: MysqlConnectionConfig;
	readCluster?: MysqlConnectionConfig;
}

export class MysqlPool {
	constructor(config: MysqlPoolConfig);
	query(queryString: string, params?: any[]): Promise<any>;
	endPool(): Promise<void>;
	healthcheck(): Promise<void>;
}

// ─── Ramp-up ──────────────────────────────────────────────────────────────────

export interface RampEntry {
	startTime: number;
	count: number;
}

export function evenRampUp(threadCount: number, rampTime: number, groupSize?: number): RampEntry[];

// ─── Random Utilities ─────────────────────────────────────────────────────────

export function randomInt(min: number, max: number): number;
export function randomNumberFrom(min: number, max: number): number;
export function checkPercent(percent: number): boolean;
export function coinFlip(): boolean;
export function randomItem<T>(array: T[]): T;
export function randomItems<T>(array: T[], min?: number, max?: number): T[];
export function randomSubString(str: string, min?: number, max?: number): string;
export function randomItemWeightedEven<T>(...arrays: T[][]): T;
export function randomItemWeightedArray<T>(...arraysWithWeight: Array<{ weight: number; array: T[] }>): T;
export function randomIntWeightedRange(...rangesWithWeight: Array<{ weight: number; range: { min: number; max: number } }>): number;
export function randomObjectWeighted<T extends { weight: number; [key: string]: any }>(...objectsWithWeight: T[]): T;
export function randomCharacters(count: number, chars?: string): string;

// ─── Sleep ────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void>;

// ─── Cache ────────────────────────────────────────────────────────────────────

export const TTL: number;
export function cache(ttl: number): Record<string, any> & { set(key: string, value: any): Record<string, any> };
export function cachedFunction<T extends (...args: any[]) => any>(fn: T, ttl?: number): (...args: Parameters<T>) => Promise<ReturnType<T>>;

// ─── Math Utilities ───────────────────────────────────────────────────────────

export function mean(data: number[]): number;
export function variance(data: number[], average?: number): number;
export function populationStandardDeviation(data: number[]): number;
export function sampleStandardDeviation(data: number[]): number;
export function combinedAverage(sampleSize1: number, mean1: number, sampleSize2: number, mean2: number): number;
export function combinedSampleStandardDeviation(sampleSize1: number, mean1: number, standardDeviation1: number, mean2: number, sampleSize2: number, standardDeviation2: number): number;
export function round(value: number, decimals?: number): number;

// ─── Run Mode ─────────────────────────────────────────────────────────────────

export const runModeFlags: Map<string, string | true>;
export function parseRunMode(runMode?: string): void;
export function whenRunModeLoaded(callback: () => void): void;

// ─── Logger ───────────────────────────────────────────────────────────────────

export const logger: Logger;
export function bindWorkers(): void;
