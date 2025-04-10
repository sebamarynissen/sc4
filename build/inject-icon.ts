// # inject-icon.ts
import cp from 'node:child_process';
import fs from 'node:fs';

// We will first need to fill in the version number in our .rc file.
const pkg = JSON.parse(fs.readFileSync('./package.json').toString('utf8'));
const rc = fs
	.readFileSync('./build/sc4.rc')
	.toString('utf8')
	.replaceAll('%SEMVER_VERSION%', pkg.version)
	.replaceAll('%COMMA_VERSION%', pkg.version.replaceAll('.', ',')+',0');
fs.writeFileSync('./dist/sc4.rc', rc);

const exe = process.env.RESOURCE_HACKER_EXECUTABLE!;
cp.execSync(`"${exe}" -open dist/sc4.exe -save dist/sc4-no-icon.exe -action delete -res 1033 -mask ICONGROUP`);
cp.execSync(`"${exe}" -open dist/sc4-no-icon.exe -save dist/sc4-with-icon.exe -action addoverwrite -res build/sc4.ico -mask ICONGROUP,MAINICON,1033`);
cp.execSync(`"${exe}" -open dist/sc4.rc -save dist/sc4.res -action compile`);
cp.execSync(`"${exe}" -open dist/sc4-with-icon.exe -save dist/sc4.exe -action addoverwrite -res dist/sc4.res -mask VERSIONINFO,1`);

fs.rmSync('./dist/sc4-with-icon.exe');
fs.rmSync('./dist/sc4-no-icon.exe');
