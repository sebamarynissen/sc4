// # inject-icon.ts
import cp from 'node:child_process';
const exe = process.env.RESOURCE_HACKER_EXECUTABLE!;
cp.execSync(`"${exe}" -open dist/sc4.exe -save dist/sc4-no-icon.exe -action delete -res 1033 -mask ICONGROUP`);
cp.execSync(`"${exe}" -open dist/sc4-no-icon.exe -save dist/sc4-with-icon.exe -action addoverwrite -res build/sc4.ico -mask ICONGROUP,MAINICON,1033`);
cp.execSync(`"${exe}" -open build/sc4.rc -save dist/sc4.res -action compile`);
cp.execSync(`"${exe}" -open dist/sc4-with-icon.exe -save dist/sc4.exe -action addoverwrite -res dist/sc4.res -mask VERSIONINFO,1`);
