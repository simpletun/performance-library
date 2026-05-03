import { config } from '../worker';
import { request } from './request';
import { logger } from './logger';
import { sleep } from './sleep';
import { randomNumberFrom } from './random';

const requestAuthToken = async (customScopes) => {

	const requestData = {
		method: 'post',
		hostname: 'nike-qa.oktapreview.com',
		path: '/oauth2/ausa0mcornpZLi0C40h7/v1/token',
		ssl: true,
		payload: `client_secret=${config.okta.clientSecret}&grant_type=password&scope=idpType%20profile%20openid%20email%20legacy_username%20${customScopes}&client_id=${config.okta.clientId}&username=${config.okta.user}&password=${config.okta.password}`,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	};

	return request(requestData);

};

export const getAuthToken = async (customScopes = 'gtms.sales.data.read') => {
	let theToken = '';
	let response;

	try {
		response = await requestAuthToken(customScopes);

		logger.debug(`My full response --> ${JSON.stringify(response)}`);

		// retry up to 10 times with sleep between
		for(let i = 0; i < 10; i++){

			if(!response.success){
				logger.warn(`Failed to get auth token, retrying... attempt [${i}]`);
				await sleep(randomNumberFrom(100, 5000));
				response = await requestAuthToken(customScopes);
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

// function requests a token from the new lpm-test server.
const requestAVTestToken = async (roleName, lock) => {
	const requestData = {
		method: 'get',
		hostname: 'lpm-foundation-services-qa.pes-preprod.nike.com',
		path: `/lpm-test-server/user/av/${encodeURI(roleName)}?lock=${lock}`,
		ssl: true,
		headers: {}
	};

	return request(requestData);
};

// exported function to get AV test token.
export const getAVTestToken = async (roleName = 'AV%20Global%20Cross%20Category%20Merchandising', lock = false) => {
	let theToken;
	let response;

	try {
		response = await requestAVTestToken(roleName, lock);

		logger.debug(`My full response --> ${JSON.stringify(response)}`);

		// retry up to 10 times with sleep between
		for(let i = 0; i < 10; i++){

			if(!response.success){
				logger.warn(`Failed to get auth token, retrying... attempt [${i}]`);
				await sleep(randomNumberFrom(100, 5000));
				response = await requestAVTestToken(roleName);
			}
			else {
				break;
			}
		}

		const body = JSON.parse(response.body);

		theToken = body.accessToken;
	}
	catch (e){
		logger.error(`Encountered an error --> ${e}`);
		logger.error(`Error stack --> ${e.stack}`);
	}

	logger.info('Successfully retrieved auth token');

	return theToken;
};
