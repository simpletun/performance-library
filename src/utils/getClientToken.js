import { config } from '../worker';
import { request } from './request';
import { logger } from './logger';
import { sleep } from './sleep';
import { randomNumberFrom } from './random';

const requestOktaToken = async ({clientId, clientSecret, scopeList }) => {

	const requestData = {
		method: 'post',
		hostname: 'nike-qa.oktapreview.com',
		path: '/oauth2/ausa0mcornpZLi0C40h7/v1/token',
		ssl: true,
		payload: `client_secret=${clientSecret}&grant_type=client_credentials&scope=${scopeList.join('%20')}&client_id=${clientId}`,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};

	return request(requestData);

};

export const getClientToken = async ({clientId = config.okta.clientId, clientSecret = config.okta.clientSecret, scopeList = ['lpm.qadefault.refdata.create', 'lpm.qadefault.refdata.read', 'lpm.qadefault.refdata.update', 'lpm.qadefault.refdata.delete'] }) => {
	let theToken = '';
	let response;

	try {
		response = await requestOktaToken({clientId, clientSecret, scopeList});

		logger.debug(`My full response --> ${JSON.stringify(response)}`);

		// retry up to 10 times with sleep between
		for(let i = 0; i < 10; i++){

			if(!response.success){
				logger.warn(`Failed to get auth token, retrying... attempt [${i}]`);
				await sleep(randomNumberFrom(100, 5000));
				response = await requestOktaToken({clientId, clientSecret, scopeList});
			}
			else {
				break;
			}
		}

		const body = JSON.parse(response.body);

		theToken = body.access_token;
	}
	catch (e){
		logger.error(`Encountered an error --> ${e}`);
		logger.error(`Error stack --> ${e.stack}`);
	}

	logger.info('Successfully retrieved auth token');

	return theToken;
};
