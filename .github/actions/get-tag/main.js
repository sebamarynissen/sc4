import github from '@actions/github';
import core from '@actions/core';

if (github.context.eventName === 'pull_request') {
	let labels = github.context.payload.pull_request.labels.map(label => label.name);
	if (labels.includes('major')) {
		core.setOutput('version', 'major');
	} else if (labels.includes('minor')) {
		core.setOutput('version', 'minor');
	} else {
		core.setOutput('version', 'patch');
	}
} else if (github.context.eventName === 'workflow_dispatch') {
	core.setOutput('version', core.getInput('version'));
}
