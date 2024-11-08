// # register-debug-utis.js
// Registers a few debugging utils, such as registering a hex function on number prototypes.
import { hex, chunk } from './util.js';
hex.register();
chunk.register();
