
const { join } = require('path');
const { readFileSync } = require('fs');
const { execSync } = require('child_process');

const isInt = /^[0-9]+$/;

// Get all the data we need to work with
const packagePath = join(process.cwd(), 'package.json');
const { name, version } = JSON.parse(readFileSync(packagePath, 'utf8'));
const versions = JSON.parse(execSync(`npm show ${name} versions --json`));

// Figure out what the new latest release for this version is
const currentVersion = version.split('-')[0];
const matchingReleases = versions.filter((version) => {
	const [ baseVersion, release, ...other ] = version.split('-');

	if (baseVersion === currentVersion) {
		if (other && other.length) {
			return false;
		}

		return isInt.test(release);
	}

	return false;
});
const latestRelease = matchingReleases.pop();

// Figure out what the new version should be (eg. latest + 1)
const newRelease = latestRelease ? parseFloat(latestRelease.split('-')[1]) + 1 : 0;

// Set the new version number and publish
execSync(`npm version ${currentVersion}-${newRelease} --no-git-tag-version`);
execSync('npm publish --tag beta');

console.log(`${currentVersion}-${newRelease}`);
