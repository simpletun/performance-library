/*
Data provider for file reads.  Creates a LineReader instance with connection to readstream.
File being read, plus other read options, are configured in scenario config file.
*/
import { logger } from '../utils/logger';
import { config, shutdown, onMessage, sendMessage } from '../worker';
import { LineReader } from '../utils/linereader';

let linereader = new LineReader({filename: config.fileName, chunkSize: config.chunkSize,
	recycleOnEof: config.recycleOnEof, bufferSize: config.bufferSize});

onMessage('stop', async () => {
	shutdown();
});

// When a worker asks for data, read the next line
onMessage('fileRead', async (requestMessage) => {
	// messages.push(fileReadObject);
	logger.silly('Provider got request for file data');
	const lineObj = await readLine(!!requestMessage.random);

	if(!lineObj.nextLine && lineObj.eof){
		logger.debug('At end of file, not configured to recycle, sending terminate message');
		const response = {
			type: 'eof'
		};

		sendMessage('direct', {
			message: response,
			to: requestMessage.from
		});
	}
	else {
		logger.silly(`Provider called readLine, got --> ${lineObj.nextLine}`);
		logger.silly(`My requestMessage object --> ${JSON.stringify(requestMessage)}`);
		const response = {
			type: requestMessage.responseType,
			results: lineObj.nextLine,
			requestId: requestMessage.requestId
		};

		sendMessage('direct', {
			message: response,
			to: requestMessage.from
		});
	}

});

const readLine = async (randomLine) => {

	let response = await linereader.nextLine(randomLine);

	return response;
};
