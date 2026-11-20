// Test server for the browser tests: embedded Postgres + the API with a fake internet.
// Usage: node test/serve.js <port> <allowed-origin>   (prints READY when listening)
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { createPool, migrate } from '../src/store.js';
import { createApp } from '../src/index.js';
import { fakeFetch } from './fakes.js';

process.env.SYNC_PAUSE_MS = '0';
const port = Number(process.argv[2] || 8790), origin = process.argv[3] || 'http://localhost:8765';
const pgPort = 56000 + Math.floor(Math.random() * 3000);
const pg = new EmbeddedPostgres({ databaseDir: path.join(os.tmpdir(), 'x4wpg-e2e-' + process.pid), user: 'postgres', password: 'pw', port: pgPort, persistent: false, onLog: () => {} });
await pg.initialise(); await pg.start();
const pool = createPool(`postgres://postgres:pw@localhost:${pgPort}/postgres`);
await migrate(pool);
const server = http.createServer(createApp({ pool, env: { SETUP_CODE: 'SETUP-TEST-1', APP_SECRET: 'test-secret-'.repeat(3), ALLOWED_ORIGINS: origin }, fetchImpl: fakeFetch }));
server.listen(port, () => console.log('READY'));
const stop = async () => { server.close(); await pool.end().catch(() => {}); await pg.stop().catch(() => {}); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
