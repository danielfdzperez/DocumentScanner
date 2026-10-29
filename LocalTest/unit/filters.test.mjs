import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImageBuffer } from '../../web/js/core/image-buffer.js';
import { AutoLevelsFilter } from '../../web/js/core/filters/auto-levels.js';
import { ClaheFilter } from '../../web/js/core/filters/clahe.js';
import { ContrastFilter } from '../../web/js/core/filters/contrast.js';
import { IlluminationFilter } from '../../web/js/core/filters/illumination.js';
import { SaturationFilter } from '../../web/js/core/filters/saturation.js';
import { WhiteBalanceFilter } from '../../web/js/core/filters/white-balance.js';
import { lumaOf } from '../../web/js/core/util/planes.js';
import { makeSyntheticDocument } from '../helpers/synthetic-document.mjs';

/** Media y desviación típica de la luminancia en los píxeles donde `mask(p)` es verdadero. */
function lumaStats(image, mask) {
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  for (let p = 0; p < image.pixelCount; p++) {
    if (!mask(p)) continue;
    const i = p * 4;
    const v = lumaOf(image.data[i], image.data[i + 1], image.data[i + 2]);
    n++;
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

function filled(width, height, [r, g, b]) {
  const image = new ImageBuffer(width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = r;
    image.data[i + 1] = g;
    image.data[i + 2] = b;
    image.data[i + 3] = 255;
  }
  return image;
}

test('ImageBuffer valida tamaños', () => {
  assert.throws(() => new ImageBuffer(0, 10));
  assert.throws(() => new ImageBuffer(2, 2, new Uint8ClampedArray(3)));
  const a = new ImageBuffer(2, 2);
  const b = a.clone();
  b.data[0] = 9;
  assert.equal(a.data[0], 0, 'clone es independiente');
});

test('IlluminationFilter elimina la sombra y mantiene el texto', () => {
  const { image, isText } = makeSyntheticDocument();
  const bg = (p) => !isText[p];
  const before = lumaStats(image, bg);

  new IlluminationFilter().apply(image, { strength: 100 });

  const after = lumaStats(image, bg);
  const text = lumaStats(image, (p) => isText[p] === 1);
  assert.ok(before.std > 25, `la muestra debe tener sombra (std ${before.std.toFixed(1)})`);
  assert.ok(after.std < before.std * 0.3, `fondo más uniforme: ${before.std.toFixed(1)} -> ${after.std.toFixed(1)}`);
  assert.ok(after.mean > 235, `el papel queda casi blanco (${after.mean.toFixed(1)})`);
  assert.ok(after.mean - text.mean > 80, `el texto sigue contrastando (${(after.mean - text.mean).toFixed(1)})`);
});

test('IlluminationFilter con 0 % no es activo y con 50 % queda entre medias', () => {
  const filter = new IlluminationFilter();
  assert.equal(filter.isActive({ strength: 0 }), false);

  const { image, isText } = makeSyntheticDocument();
  const half = image.clone();
  const full = image.clone();
  filter.apply(half, { strength: 50 });
  filter.apply(full, { strength: 100 });
  const bg = (p) => !isText[p];
  const s0 = lumaStats(image, bg).std;
  const s50 = lumaStats(half, bg).std;
  const s100 = lumaStats(full, bg).std;
  assert.ok(s100 < s50 && s50 < s0);
});

test('WhiteBalanceFilter neutraliza el tinte del papel', () => {
  const { image, isText } = makeSyntheticDocument();
  const cast = (img) => {
    const s = lumaStats(img, () => true); // solo para tener la función usada
    let r = 0;
    let b = 0;
    let n = 0;
    for (let p = 0; p < img.pixelCount; p++) {
      if (isText[p]) continue;
      r += img.data[p * 4];
      b += img.data[p * 4 + 2];
      n++;
    }
    return Math.abs(r / n - b / n) + s.mean * 0;
  };
  const before = cast(image);
  new WhiteBalanceFilter().apply(image, { strength: 100 });
  const after = cast(image);
  assert.ok(before > 25);
  assert.ok(after < before * 0.35, `diferencia R-B ${before.toFixed(1)} -> ${after.toFixed(1)}`);
});

test('ClaheFilter: imagen plana se mantiene y una de bajo contraste gana contraste local', () => {
  const clahe = new ClaheFilter();
  assert.equal(clahe.isActive({ level: 0 }), false);

  const flat = filled(64, 64, [255, 255, 255]);
  clahe.apply(flat, { level: 5 });
  assert.ok(flat.data.every((v, i) => (i % 4 === 3 ? v === 255 : v >= 250)), 'el blanco liso no se estropea');

  const { image } = makeSyntheticDocument({ width: 200, height: 260 });
  const before = lumaStats(image, () => true).std;
  clahe.apply(image, { level: 6 });
  const after = lumaStats(image, () => true).std;
  assert.ok(after > before, `desviación ${before.toFixed(1)} -> ${after.toFixed(1)}`);
});

test('AutoLevelsFilter estira el rango', () => {
  const image = new ImageBuffer(10, 10);
  for (let p = 0; p < 100; p++) {
    const v = 100 + (p % 10) * 5; // 100..145
    image.data.set([v, v, v, 255], p * 4);
  }
  new AutoLevelsFilter().apply(image, { strength: 100 });
  const values = Array.from({ length: 100 }, (_, p) => image.data[p * 4]);
  assert.ok(Math.min(...values) <= 5 && Math.max(...values) >= 250);
});

test('ContrastFilter conserva el gris medio y separa los extremos', () => {
  const filter = new ContrastFilter();
  assert.equal(filter.isActive({ amount: 0 }), false);
  const image = new ImageBuffer(3, 1);
  image.data.set([128, 128, 128, 255, 100, 100, 100, 255, 160, 160, 160, 255]);
  filter.apply(image, { amount: 50 }); // x3
  assert.equal(image.data[0], 128);
  assert.ok(image.data[4] < 100 && image.data[8] > 160);
});

test('SaturationFilter: 0 % da grises y 100 % no hace nada', () => {
  const filter = new SaturationFilter();
  assert.equal(filter.isActive({ percent: 100 }), false);
  const image = filled(2, 2, [200, 80, 40]);
  filter.apply(image, { percent: 0 });
  assert.equal(image.data[0], image.data[1]);
  assert.equal(image.data[1], image.data[2]);
});
