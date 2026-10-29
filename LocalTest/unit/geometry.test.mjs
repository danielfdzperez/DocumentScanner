import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cropPerspective,
  defaultCorners,
  isValidQuad,
  orderCorners,
  quadOutputSize,
  resizeToFit,
  rotatePointQuarter,
  rotateQuarter,
} from '../../web/js/core/geometry.js';
import { ImageBuffer } from '../../web/js/core/image-buffer.js';

/** Imagen cuyo píxel (x, y) vale R=x, G=y: permite saber de dónde viene cada píxel del resultado. */
function coordinateImage(width, height) {
  const img = new ImageBuffer(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) img.data.set([x, y, 0, 255], (y * width + x) * 4);
  }
  return img;
}

const px = (img, x, y) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

test('rotateQuarter: dimensiones, esquinas y vuelta completa', () => {
  const img = coordinateImage(4, 2);
  const cw = rotateQuarter(img, 1);
  assert.deepEqual([cw.width, cw.height], [2, 4]);
  // la esquina arriba-izquierda original (0,0) pasa a arriba-derecha
  assert.deepEqual(px(cw, 1, 0), [0, 0, 0]);
  // la esquina arriba-derecha original (3,0) pasa a abajo-derecha
  assert.deepEqual(px(cw, 1, 3), [3, 0, 0]);

  const ccw = rotateQuarter(img, -1);
  assert.deepEqual(px(ccw, 0, 3), [0, 0, 0], 'antihorario: (0,0) -> abajo-izquierda');

  let r = img;
  for (let i = 0; i < 4; i++) r = rotateQuarter(r, 1);
  assert.deepEqual(r.data, img.data);
  assert.deepEqual(rotateQuarter(rotateQuarter(img, 1), -1).data, img.data);
});

test('rotatePointQuarter es coherente con rotateQuarter', () => {
  const p = { x: 0.25, y: 0.1 };
  const turned = rotatePointQuarter(p, 1);
  assert.deepEqual(turned, { x: 0.9, y: 0.25 });
  const back = rotatePointQuarter(turned, -1);
  assert.ok(Math.abs(back.x - p.x) < 1e-12 && Math.abs(back.y - p.y) < 1e-12);
});

test('orderCorners ordena TL, TR, BR, BL sea cual sea la entrada', () => {
  const [tl, tr, br, bl] = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.2 },
    { x: 0.8, y: 0.9 },
    { x: 0.2, y: 0.8 },
  ];
  assert.deepEqual(orderCorners([br, tl, bl, tr]), [tl, tr, br, bl]);
  assert.deepEqual(orderCorners([bl, br, tr, tl]), [tl, tr, br, bl]);
  assert.throws(() => orderCorners([tl, tr, br]));
});

test('isValidQuad rechaza cóncavos, cruzados y degenerados', () => {
  assert.ok(isValidQuad(defaultCorners(0.1)));
  const concave = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0.2, y: 0.2 },
    { x: 0, y: 1 },
  ];
  assert.equal(isValidQuad(concave), false);
  const collinear = [0, 0.3, 0.6, 1].map((v) => ({ x: v, y: v }));
  assert.equal(isValidQuad(collinear), false);
});

test('cropPerspective con un rectángulo alineado extrae exactamente esa zona', () => {
  const img = coordinateImage(100, 80);
  const out = cropPerspective(img, [
    { x: 0.2, y: 0.25 },
    { x: 0.7, y: 0.25 },
    { x: 0.7, y: 0.75 },
    { x: 0.2, y: 0.75 },
  ]);
  assert.deepEqual([out.width, out.height], [50, 40]);
  assert.deepEqual(px(out, 0, 0), [20, 20, 0]);
  assert.deepEqual(px(out, 49, 39), [69, 59, 0]);
  assert.deepEqual(px(out, 25, 10), [45, 30, 0]);
});

test('cropPerspective endereza un cuadrilátero inclinado (las esquinas van a las esquinas)', () => {
  const img = coordinateImage(200, 200);
  const quad = [
    { x: 40 / 200, y: 20 / 200 },
    { x: 170 / 200, y: 50 / 200 },
    { x: 150 / 200, y: 180 / 200 },
    { x: 20 / 200, y: 140 / 200 },
  ];
  const out = cropPerspective(img, quad);
  const near = (actual, expected) => Math.abs(actual - expected) <= 2;
  const check = (x, y, ex, ey) => {
    const [r, g] = px(out, x, y);
    assert.ok(near(r, ex) && near(g, ey), `(${x},${y}) -> (${r},${g}), esperado (${ex},${ey})`);
  };
  check(0, 0, 40, 20);
  check(out.width - 1, 0, 170, 50);
  check(out.width - 1, out.height - 1, 150, 180);
  check(0, out.height - 1, 20, 140);
});

test('cropPerspective acepta los puntos en cualquier orden y falla con un cuadrilátero inválido', () => {
  const img = coordinateImage(60, 60);
  const a = cropPerspective(img, [
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.2 },
    { x: 0.2, y: 0.8 },
    { x: 0.8, y: 0.2 },
  ]);
  assert.deepEqual([a.width, a.height], [36, 36]);
  assert.throws(
    () =>
      cropPerspective(img, [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
        { x: 0.9, y: 0.9 },
        { x: 0.3, y: 0.3 },
      ]),
    RangeError,
  );
});

test('resizeToFit reduce promediando y nunca amplía', () => {
  const img = new ImageBuffer(4, 2);
  for (let p = 0; p < 8; p++) img.data.set([p < 4 ? 0 : 200, 100, 50, 255], p * 4);
  assert.equal(resizeToFit(img, 10), img, 'si cabe devuelve la misma');
  const small = resizeToFit(img, 2);
  assert.deepEqual([small.width, small.height], [2, 1]);
  assert.deepEqual(px(small, 0, 0), [100, 100, 50], 'promedio de la mitad 0 y la mitad 200');
});

test('quadOutputSize usa el mayor de cada par de lados opuestos', () => {
  const size = quadOutputSize([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 90, y: 50 },
    { x: 10, y: 40 },
  ]);
  // lados: arriba 100, abajo 80 -> 100; izquierdo ~41, derecho ~51 -> 51
  assert.deepEqual(size, { width: 100, height: 51 });
});
