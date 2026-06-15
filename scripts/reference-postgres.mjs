import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, '.reference-postgres');
const DATA_DIR = path.join(STATE_DIR, 'data');
const LOG_FILE = path.join(STATE_DIR, 'postgres.log');
const PORT = Number(process.env.REFERENCE_DB_PORT || 55440);
const USER = process.env.REFERENCE_DB_USER || 'ndda_reference';
const DB = process.env.REFERENCE_DB_NAME || 'ndda_reference_kb';

const cmd = process.argv[2] || 'status';

if (cmd === 'start') await start();
else if (cmd === 'stop') await stop();
else if (cmd === 'status') await status();
else {
  console.error('Usage: node scripts/reference-postgres.mjs start|stop|status');
  process.exit(1);
}

async function start() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  if (!(await exists(path.join(DATA_DIR, 'PG_VERSION')))) {
    run('initdb', ['-D', DATA_DIR, '-U', USER, '--auth=trust', '--encoding=UTF8'], 'initdb failed');
  }

  const statusResult = spawnSync('pg_ctl', ['-D', DATA_DIR, 'status'], { encoding: 'utf-8' });
  if (statusResult.status !== 0) {
    run(
      'pg_ctl',
      ['-D', DATA_DIR, '-l', LOG_FILE, '-o', `-p ${PORT} -h 127.0.0.1 -c unix_socket_directories=${STATE_DIR}`, 'start'],
      'Postgres start failed'
    );
  }

  const dbExists = spawnSync('psql', ['-h', '127.0.0.1', '-p', String(PORT), '-U', USER, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${DB}'`], {
    encoding: 'utf-8',
  });
  if (!dbExists.stdout.includes('1')) {
    run('createdb', ['-h', '127.0.0.1', '-p', String(PORT), '-U', USER, DB], 'Database creation failed');
  }

  const url = `postgresql://${USER}@127.0.0.1:${PORT}/${DB}`;
  await fs.writeFile(path.join(STATE_DIR, 'database-url'), `${url}\n`, 'utf-8');
  console.log(`Reference Postgres is running on 127.0.0.1:${PORT}`);
  console.log(`REFERENCE_DATABASE_URL=${url}`);
}

async function stop() {
  if (!(await exists(path.join(DATA_DIR, 'PG_VERSION')))) {
    console.log('Reference Postgres is not initialized.');
    return;
  }
  const result = spawnSync('pg_ctl', ['-D', DATA_DIR, 'stop', '-m', 'fast'], { encoding: 'utf-8' });
  if (result.status !== 0 && !result.stderr.includes('PID file does not exist')) {
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
  console.log('Reference Postgres stopped.');
}

async function status() {
  if (!(await exists(path.join(DATA_DIR, 'PG_VERSION')))) {
    console.log('Reference Postgres is not initialized.');
    return;
  }
  const result = spawnSync('pg_ctl', ['-D', DATA_DIR, 'status'], { encoding: 'utf-8' });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status || 0);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, message) {
  const result = spawnSync(command, args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(message);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
