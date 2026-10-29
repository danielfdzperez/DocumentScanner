// Ejecuta todos los tests unitarios (LocalTest/unit/*.test.mjs) con el runner integrado de Node.
// Se lista la carpeta a mano porque `node --test` sin argumentos también ejecutaría
// serve.mjs (está dentro de "test") y se quedaría colgado.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const unitDir = join(dirname(fileURLToPath(import.meta.url)), 'unit');
const files = readdirSync(unitDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => join(unitDir, name));

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
