import github from '@actions/github';
import core from '@actions/core';

if (github.context.eventName === 'pull_request') {
	let labels = github.context.payload.pull_request.labels.map(label => label.name);
	if (labels.includes('major')) {
		core.setOutput('version', 'major');
	} else if (labels.includes('minor')) {
		core.setOutput('version', 'minor');
	} else if (labels.includes('prepatch')) {
		core.setOutput('version', 'prepatch');
	} else if (labels.includes('preminor')) {
		core.setOutput('version', 'preminor');
	} else if (labels.includes('premajor')) {
		core.setOutput('version', 'premajor');
	} else if (labels.includes('prerelease')) {
		core.setOutput('version', 'prerelease');
	} else {
		core.setOutput('version', 'patch');
	}
} else if (github.context.eventName === 'workflow_dispatch') {
	core.setOutput('version', core.getInput('version'));
}
