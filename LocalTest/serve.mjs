// Servidor estático local para probar la web igual que en GitHub Pages.
// Uso:  node LocalTest/serve.mjs [puerto]        (por defecto 8080)
// Sirve la RAÍZ del repositorio, así que http://localhost:8080/ redirige a /web/ como en Pages.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store', // en pruebas siempre se ve el último cambio
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not found');
  }
});

server.listen(port, () => {
  console.log(`\n  Document Scanner (local)\n`);
  console.log(`  PC:     http://localhost:${port}/`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === 'IPv4' && !a.internal) {
        console.log(`  Móvil:  http://${a.address}:${port}/   (la cámara en vivo NO funciona por http; subir foto sí)`);
      }
    }
  }
  console.log(`\n  Ctrl+C para parar.\n`);
});
