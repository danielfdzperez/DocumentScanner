import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImageFilter } from '../../web/js/core/contracts.js';
import { ImageBuffer } from '../../web/js/core/image-buffer.js';
import { Pipeline, createDefaultPipeline } from '../../web/js/core/pipeline.js';
import { CONTROLS, NEUTRAL_SETTINGS, PRESETS, cloneSettings, getPreset } from '../../web/js/core/settings.js';
import { boxBlur, maxFilter, upscaleBilinear } from '../../web/js/core/util/planes.js';
import { makeSyntheticDocument } from '../helpers/synthetic-document.mjs';

test('los contratos abstractos fallan con un error claro', () => {
  assert.throws(() => new ImageFilter().id, /no está implementado/);
  assert.throws(() => new ImageFilter().apply(), /no está implementado/);
});

test('Pipeline no modifica el original y devuelve el mismo objeto si todo está desactivado', () => {
  const pipeline = createDefaultPipeline();
  const { image } = makeSyntheticDocument({ width: 120, height: 160 });
  const copy = image.clone();

  assert.equal(pipeline.run(image, NEUTRAL_SETTINGS), image);

  const out = pipeline.run(image, getPreset('document').settings);
  assert.notEqual(out, image);
  assert.deepEqual(image.data, copy.data, 'el original no cambia');
  assert.notDeepEqual(out.data, image.data, 'el resultado sí cambia');
});

test('Pipeline valida sus filtros', () => {
  assert.throws(() => new Pipeline([{}]), TypeError);
  class Fake extends ImageFilter {
    get id() {
      return 'fake';
    }
  }
  assert.throws(() => new Pipeline([new Fake(), new Fake()]), /duplicado/);
});

test('cada control y cada preset corresponde a un filtro del pipeline y respeta sus rangos', () => {
  const ids = new Set(createDefaultPipeline().filters.map((f) => f.id));
  for (const spec of CONTROLS) assert.ok(ids.has(spec.filterId), `sin filtro para ${spec.filterId}`);

  for (const preset of PRESETS) {
    for (const spec of CONTROLS) {
      const value = preset.settings[spec.filterId]?.[spec.option];
      assert.ok(Number.isFinite(value), `${preset.id}: falta ${spec.filterId}.${spec.option}`);
      assert.ok(value >= spec.min && value <= spec.max, `${preset.id}: ${spec.filterId} fuera de rango`);
    }
  }
});

test('todos los presets se ejecutan sobre una imagen pequeña', () => {
  const pipeline = createDefaultPipeline();
  const tiny = new ImageBuffer(7, 5, new Uint8ClampedArray(7 * 5 * 4).fill(180));
  for (const preset of PRESETS) {
    const out = pipeline.run(tiny, preset.settings);
    assert.equal(out.width, 7);
    assert.equal(out.height, 5);
  }
});

test('el preset "document" aumenta el contraste texto/fondo respecto al original', () => {
  const { image, isText } = makeSyntheticDocument({ width: 300, height: 400 });
  const out = createDefaultPipeline().run(image, getPreset('document').settings);
  const gap = (img) => {
    let bg = 0;
    let tx = 0;
    let nb = 0;
    let nt = 0;
    for (let p = 0; p < img.pixelCount; p++) {
      const v = img.data[p * 4 + 1];
      if (isText[p]) (tx += v), nt++;
      else (bg += v), nb++;
    }
    return bg / nb - tx / nt;
  };
  assert.ok(gap(out) > gap(image) * 1.3, `${gap(image).toFixed(0)} -> ${gap(out).toFixed(0)}`);
});

test('cloneSettings es profunda', () => {
  const copy = cloneSettings(getPreset('document').settings);
  copy.contrast.amount = 99;
  assert.notEqual(getPreset('document').settings.contrast.amount, 99);
});

test('utilidades de planos', () => {
  const plane = { width: 5, height: 4, data: new Float32Array(20).fill(7) };
  assert.ok(boxBlur(plane, 2, 2).data.every((v) => Math.abs(v - 7) < 1e-4));
  assert.ok(maxFilter(plane, 1).data.every((v) => v === 7));
  assert.ok(upscaleBilinear(plane, 11, 9).every((v) => Math.abs(v - 7) < 1e-4));

  const spike = { width: 5, height: 1, data: new Float32Array([0, 0, 9, 0, 0]) };
  assert.deepEqual(Array.from(maxFilter(spike, 1).data), [0, 9, 9, 9, 0]);
});
