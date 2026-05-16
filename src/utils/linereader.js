//TODO: Determine if this works in the library

import { createReadStream } from 'fs';
import { logger } from './logger.js';
import { randomItem } from './random.js';

const lineend = /\r\n?|\n/;
const props = new WeakMap();

export class LineReader {
	/** @param {{ filename: string, chunkSize?: number, recycleOnEof?: boolean, bufferSize?: number }} options */
	constructor({ filename, chunkSize = 10240, recycleOnEof = true, bufferSize = 64 * 1024 }) {

		/** @type {string[]} */
		let lineArray = [];

		props.set(this, {
			lineArray,
			chunkSize: chunkSize,
			state: 'opening',
			recycleOnEof,
			filename,
			eof: false,
			bufferSize
		});

		props.get(this).readStream = this.getNewStream(filename);

		props.get(this).readStream.on('end', () => {
			logger.silly('Stream ended!');
			props.get(this).state = 'closing';
			props.get(this).eof = true;
			this.closeStream();
		});
	}

	async nextLine(randomLine = false) {
		const _props = props.get(this);

		// Loops, checking state
		while(true){
			switch(_props.state){
				case 'closing':
					logger.silly('State is closing, awaiting closed');
					await this.closed;
					break;

				case 'closed':
					logger.silly('State is closed');
					// If state is closed, then we are at eof

					// First account for files with empty last row
					if(_props.lineArray.length === 1 && _props.lineArray[0] === ''){
						logger.silly('Throwing out empty last line');
						_props.lineArray.shift();
					}

					// Next read out remaining rows
					if(_props.lineArray.length){
						logger.silly('LineArray still has length, returning row');

						if(!randomLine){
							return { nextLine: _props.lineArray.shift(), eof: false };
						}
						else {
							return { nextLine: this.getRandomLine(_props.lineArray), eof: false };
						}
					}
					// Else if closed and no lines left to read, determine whether we are going to recycle
					// this stream and get a new one
					else {
						// If we aren't configured to recycle and we're at eof, return null nextLine with true eof value
						if(!_props.recycleOnEof && _props.eof){
							logger.silly('At eof, not recycling, returning null');

							return { nextLine: null, eof: _props.eof };
						}
						// Else we need to get a new stream
						else {
							logger.silly('Recycling on eof');
							_props.readStream = this.getNewStream(_props.filename);
						}
					}

					break;

				case 'opening':
					logger.silly('State is opening, awaiting readable');
					// If state is opening, await readable state
					await this.readable;
					break;

				case 'readable':
					logger.silly('State is readable, getting data');
					let chunk = null, nextLine = null, partialLine = null;

					// Proceed to read from file only if there are no lines in the lineArray from previous reads.
					// Or if there is only one line, which may indicate it is a partial line from the last read chunk.
					if(!_props.lineArray.length || _props.lineArray.length === 1){

						// if lineArray length is only one and that value is not an empty string, this is a partial line,
						// and we need to capture it to prepend to the first line of the next read chunk.
						if(_props.lineArray.length === 1 && _props.lineArray[0] !== ''){
							partialLine = _props.lineArray.shift();
						}

						// Read a chunk from the stream
						chunk = this.getChunk();

						if(chunk == null){
							logger.silly('Chunk is null, reached end of file, awaiting closed.');
							this.closeStream();
							await this.closed;
							break;
						}

						// Only proceed to parse chunk if it has a a value.
						if(chunk){
							_props.lineArray = chunk.toString().split(lineend);

							// if partialLine was kept from before, concatenate this with first line in new line array.
							if(partialLine){
								_props.lineArray[0] = partialLine + _props.lineArray[0];
								partialLine = null;
							}
						}
						// If there is no chunk, check to see if there's something in partialLine.  This would be the
						// case if we read the last chunk from the file and closed the stream.
						else {
							if(partialLine){
								nextLine = partialLine;
							}

							return { nextLine, eof: _props.eof };
						}
					}

					// If we do have a lineArray by now with any length, shift the first line off and return.
					if(_props.lineArray && _props.lineArray.length){
						if(!randomLine){
							nextLine = _props.lineArray.shift();
						}
						else {
							nextLine = this.getRandomLine(_props.lineArray);
						}
					}

					logger.silly(`nextline is --> ${nextLine}`);
					logger.silly(`My linearray has length ${_props.lineArray.length}`);

					return { nextLine, eof: _props.eof };
			}
		}
	}

	getChunk() {
		const _props = props.get(this);

		let chunk;

		try {
			if (_props.readStream){
				chunk = _props.readStream.read(_props.chunkSize);
				logger.silly(`Read a chunk --> ${chunk}`);
			}
		}
		catch (err) {
			logger.error(`Error was thrown during read --> ${err}`);
		}

		return chunk;
	};

	closeStream() {
		const _props = props.get(this);

		logger.silly('Running closeStream, deleting readStream reference');
		if(_props.readStream){
			delete _props.readStream;
		}
	};

	/**
	 * @param {import('fs').ReadStream} readStream
	 * @returns {Promise<void>}
	 */
	isReadable(readStream) {
		// Promise resolves 50 ms after stream is readable, gives a bit of time for socket to be available
		return new Promise((resolve) => {
			readStream.on('readable', () => {
				logger.silly('Stream is readable!');
				setTimeout(() => {
					props.get(this).state = 'readable';
					props.get(this).eof = false;
					resolve();
				}, 50);

			});
		});
	}

	/**
	 * @param {import('fs').ReadStream} readStream
	 * @returns {Promise<void>}
	 */
	isClosed(readStream) {
		// Promise resolves 50 ms after stream is closed, gives a bit of time for socket to be released
		return new Promise((resolve) => {
			readStream.on('close', () => {
				logger.silly('Stream is closed!');
				setTimeout(() => {
					props.get(this).state = 'closed';
					resolve();
				}, 50);
			});
		});
	}

	/** @param {string} filename */
	getNewStream(filename) {
		logger.silly('Running getNewStream');

		const _props = props.get(this);
		const readStream = createReadStream(filename, {start: 0, highWaterMark: _props.bufferSize});

		// Pause stream immediately
		readStream.pause();

		// After creating new stream, set state to opening, create promises to fullfill when state is readable/closed
		_props.state = 'opening';
		this.readable = this.isReadable(readStream);
		this.closed = this.isClosed(readStream);

		return readStream;
	};

	/**
	 * @param {string[]} lineArray
	 * @returns {string}
	 */
	getRandomLine(lineArray) {
		let testLine = randomItem(lineArray);

		if(testLine !== ''){
			return testLine;
		}
		else {
			return this.getRandomLine(lineArray);
		}
	}
};

