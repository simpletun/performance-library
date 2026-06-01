
import { request } from './request.js';
import { config, sendMessage } from '../worker.js';
import { logger } from './logger.js';
import { JSONPath as jsonpath } from 'jsonpath-plus';
import { trace } from '@opentelemetry/api';
import { runModeFlags } from '../run-mode.js';


// makeRequest function wraps request, itself a simple wrapper for http/https requests, to expose additional functionality specific to perf scenarios.
// Additional functionality includes defaulting some request params, tracking the response in the scenario, parsing out response fields, and
// ignoring certain types of errors.
/**
 * @param {{ transactionName: string, requestConfig: { path: string, [key: string]: any }, parseField?: string, returnBody?: boolean, ignoreError?: boolean, ignoredCodes?: number[], trackRequest?: boolean }} options
 */
export const makeRequest = async ({ transactionName, requestConfig, parseField = '', returnBody = false, ignoreError = false, ignoredCodes = [], trackRequest = true }) => {
	let tracer, span;
	const requestData = {
		method: 'get',
		hostname: config.server?.hostname ?? '',
		port: config.server?.port,
		headers: config.server?.headers ?? {},
		ssl: config.server?.ssl,
		...requestConfig
	};

	logger.silly('-------> Making Request with requestData --> ', requestData);

	if(runModeFlags.has('signalfx') || runModeFlags.has('otel-traces')){
		tracer = trace.getTracer('perflib-request');
		span = tracer.startSpan(transactionName);
	}

	const { startTime, duration, status, success, body, error, bytes, sentBytes, connect, latency } = await request(requestData);

	let reportedSuccess = success;

	// if ignoring errors, set success override
	if(ignoreError || ignoredCodes.includes(status.toString())){
		reportedSuccess = true;
	}

	if(span){
		span.setAttributes({
			'perf.res.status': status,
			'perf.res.success': reportedSuccess,
			'perf.res.bytes': bytes,
			'perf.res.sentBytes': sentBytes,
			'perf.res.latency': latency,
			'perf.res.error': error,
			'perf.res.duration': duration,
			'perf.res.startTime': startTime,
			'perf.res.path': requestData.path
		});
		span.end();
	}

	let returnField;

	// if parsing response field, run through jsonpath-plus library to grab response field value.
	if(parseField){
		logger.silly(`parseField attribute is set to --> ${parseField}`);

		try{
			returnField = jsonpath({path: parseField, json: JSON.parse(body), wrap: false});
			logger.silly(`My body parsed field is ${returnField}`);
		}
		catch (e) {
			logger.warn(`Unable to parse field at json path --> ${parseField}`);
			logger.warn(`Caused by Error -> ${e}`);
			returnField = null;
		}
	}

	/** @param {string} name */
	const send = (name) =>
		sendMessage('response', {
			name,
			startTime,
			duration,
			status,
			success: reportedSuccess,
			error,
			bytes,
			sentBytes,
			connect,
			latency,
			path: requestConfig.path
		});

	// if tracking request (defaults to true) then send the response details for writing to output stream.
	if(trackRequest){
		send(`REQ - ${transactionName}`);
	}

	if(returnBody && success){
		return { body, status };
	}
	else if(parseField && success){
		return { parsedValue: returnField, status };
	}
	else {
		return { status };
	}
};
