// # inject-icon.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cp from 'node:child_process';

const exe = process.env.RESOURCE_HACKER_EXECUTABLE!;
const source = path.join(process.cwd(), 'dist/sc4.exe');
const icon = fileURLToPath(new URL(import.meta.resolve('./sc4.ico')));
cp.execSync(`"${exe}" -open "${source}" -save "${source}" -action addoverwrite -res "${icon}" -mask ICONGROUP,MAINICON`);
