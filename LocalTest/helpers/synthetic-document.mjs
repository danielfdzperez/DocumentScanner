// Genera un "documento fotografiado" sintético y determinista: papel con tinte cálido,
// líneas de texto de bajo contraste, una sombra diagonal y ruido de sensor.
import { ImageBuffer } from '../../web/js/core/image-buffer.js';

/** PRNG determinista (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {{ width?: number, height?: number, seed?: number }} [opts]
 * @returns {{ image: ImageBuffer, isText: Uint8Array }} `isText` marca los píxeles que son texto
 */
export function makeSyntheticDocument({ width = 600, height = 800, seed = 7 } = {}) {
  const random = rng(seed);
  const image = new ImageBuffer(width, height);
  const isText = new Uint8Array(width * height);

  // Líneas de texto: rectángulos finos agrupados en párrafos.
  const lineHeight = Math.round(height / 80);
  const gap = lineHeight * 2;
  for (let y = Math.round(height * 0.08); y < height * 0.92; y += gap) {
    if (random() < 0.12) continue; // salto de párrafo
    const x0 = Math.round(width * 0.1);
    const x1 = Math.round(width * (0.7 + random() * 0.2));
    for (let yy = y; yy < y + lineHeight && yy < height; yy++) {
      for (let x = x0; x < x1; x++) {
        // huecos entre palabras
        if (Math.floor(x / (lineHeight * 3)) % 5 === 4) continue;
        isText[yy * width + x] = 1;
      }
    }
  }

  const paper = [232, 220, 190]; // papel con tinte cálido
  const ink = [95, 92, 98]; // tinta poco contrastada
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const base = isText[p] ? ink : paper;

      // Sombra: degradado diagonal + mancha suave.
      const diagonal = 1 - 0.55 * Math.max(0, (x / width + y / height - 0.7) / 1.3);
      const dx = (x - width * 0.25) / (width * 0.3);
      const dy = (y - height * 0.7) / (height * 0.2);
      const blob = 1 - 0.35 * Math.exp(-(dx * dx + dy * dy));
      const light = diagonal * blob;

      const noise = (random() - 0.5) * 8;
      const i = p * 4;
      image.data[i] = base[0] * light + noise;
      image.data[i + 1] = base[1] * light + noise;
      image.data[i + 2] = base[2] * light + noise;
      image.data[i + 3] = 255;
    }
  }
  return { image, isText };
}
