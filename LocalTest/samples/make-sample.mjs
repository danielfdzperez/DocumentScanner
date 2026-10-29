// Genera imágenes de ejemplo para probar la web sin cámara:
//   LocalTest/samples/documento-sombra.png
// Uso:  node LocalTest/samples/make-sample.mjs
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../helpers/png.mjs';
import { makeSyntheticDocument } from '../helpers/synthetic-document.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const { image } = makeSyntheticDocument({ width: 900, height: 1200 });
await writeFile(join(dir, 'documento-sombra.png'), encodePng(image));
console.log('Generado LocalTest/samples/documento-sombra.png');
