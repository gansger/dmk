import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const adminCredentials = { username: 'admin', password: 'test-password-123' };

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Starts the real server as a child process with an empty temporary database and
// no access to .env.local, so tests never touch real data or real integrations.
export async function startServer(env = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cms-test-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['--no-warnings', 'src/server.js'], {
    cwd: rootDir,
    env: {
      ...process.env,
      CMS_ENV_FILE: '',
      PORT: String(port),
      CMS_DB_PATH: path.join(tempDir, 'cms.sqlite'),
      CMS_ADMIN_USERNAME: adminCredentials.username,
      CMS_ADMIN_PASSWORD: adminCredentials.password,
      CMS_TELEGRAM_POLL_MS: String(24 * 60 * 60 * 1000),
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_WEBHOOK_SECRET: '',
      BITRIX_WEBHOOK_URL: '',
      OPENAI_API_KEY: '',
      OPENAI_BASE_URL: 'https://ai.invalid/v1',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start:\n${output}`)), 15000);
    const onData = (chunk) => {
      output += chunk;
      if (output.includes('is running')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with code ${code}:\n${output}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  let cookie = '';

  async function request(pathname, { method = 'GET', body, headers = {}, auth = true } = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && cookie ? { Cookie: cookie } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, headers: response.headers, text, json };
  }

  async function login(credentials = adminCredentials) {
    const response = await request('/api/auth/login', { method: 'POST', body: credentials, auth: false });
    const setCookie = response.headers.get('set-cookie');
    if (response.status === 200 && setCookie) cookie = setCookie.split(';')[0];
    return response;
  }

  function logoutLocally() {
    cookie = '';
  }

  async function stop() {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    await rm(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }

  return { baseUrl, request, login, logoutLocally, stop };
}
