// Development: rebuild the web app on change and restart the API server on change.
import { spawn } from 'node:child_process';

const run = (cmd, args, name) => {
  const p = spawn(cmd, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  p.on('exit', (code) => {
    console.log(`[${name}] exited with ${code}`);
    process.exit(code ?? 0);
  });
  return p;
};

const web = run(process.execPath, ['scripts/build.mjs', '--watch'], 'web');
const api = run(process.execPath, ['--disable-warning=ExperimentalWarning', '--import', 'tsx', '--watch', 'server/index.ts'], 'api');
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (web.kill(), api.kill(), process.exit(0)));
