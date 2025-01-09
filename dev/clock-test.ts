import path from "node:path";
import { Savegame } from "sc4/core";

// # clock-test.ts
let dbpf = new Savegame(path.join(process.env.SC4_REGIONS!, 'suburb/City - clock.sc4'));
let entry = dbpf.find({ type: 0xa7e7f929 });
let buffer = entry?.decompress();
console.log(`new Uint8Array([${buffer!.join(',')}])`);
