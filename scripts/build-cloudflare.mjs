import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontendDirectory = fileURLToPath(new URL('../frontend/', import.meta.url));
const viteScript = fileURLToPath(new URL('../frontend/node_modules/vite/bin/vite.js', import.meta.url));
const result = spawnSync(process.execPath, [viteScript, 'build'], {
  cwd: frontendDirectory,
  env: { ...process.env, VITE_BASE_PATH: '/Smartinventoryforecastingsystem' },
  stdio: 'inherit'
});

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
