/* eslint-disable @typescript-eslint/no-require-imports */
// Local integration checks use a dedicated database, never the configured store DB.
const { loadEnvConfig } = require('@next/env');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
loadEnvConfig(process.cwd());
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('QA runner requires a local database');
url.pathname = '/clothin_settings_qa';
const result = spawnSync(process.argv[2], process.argv.slice(3), {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url.href, SETTINGS_ENCRYPTION_KEY: process.env.SETTINGS_QA_KEY || randomBytes(32).toString('base64') },
});
process.exit(result.status ?? 1);
