import { createRequire } from 'node:module';

// Compatibility entry point: legacy commands that still start
// src/bootstrap/server.js must use the same complete API as server.cjs.
const require = createRequire(import.meta.url);
const { app } = require('../../server.cjs');

export const createApp = () => app;
