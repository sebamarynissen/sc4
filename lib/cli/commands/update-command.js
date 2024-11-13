// # update-command.js
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import cp from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';

// # update()
// Performs an update.
export async function update() {

	// Get the latest release info.
	let spinner = ora('Fetching latest release info').start();
	const octokit = new Octokit();
	let { data } = await octokit.repos.getLatestRelease({
		owner: 'sebamarynissen',
		repo: 'sc4',
	});
	spinner.succeed();

	// Find the binary to use for this platform.
	let { assets } = data;
	let asset = assets.find(asset => asset.name.includes('.exe'));

	// Download it.
	const currentExePath = process.execPath;
	const dir = path.dirname(currentExePath);
	let temp = path.join(path.dirname(currentExePath), 'download.exe');
	let url = asset.browser_download_url;
	spinner = ora(`Downloading ${chalk.cyan(url)}`).start();
	let res = await fetch(asset.browser_download_url);
	let ws = fs.createWriteStream(temp);
	await finished(Readable.fromWeb(res.body).pipe(ws));
	spinner.succeed();

	// Overwrite ourselves and then restart again.
	const command = `taskkill /F /IM "${path.basename(currentExePath)}"
timeout /t 3 /nobreak
:retry_copy 
copy /Y "${temp}" "${currentExePath}" || (
	timeout /t 1
	goto retry_copy
)`;
	let update = path.join(dir, 'update.bat');
	fs.writeFileSync(update, command);
	const child = cp.exec(`"${update}"`, {
		detached: true,
		stdio: 'ignore',
	});
	child.unref();

}
