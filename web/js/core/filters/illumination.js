// @ts-check
import { ImageFilter } from '../contracts.js';
import {
  boxBlur,
  clamp,
  downscaleMax,
  extractLuma,
  maxFilter,
  upscaleBilinear,
} from '../util/planes.js';

const ESTIMATE_SIDE = 200; // lado mayor del mapa de iluminación (baja resolución)
const DILATE_RADIUS = 4; // en píxeles del mapa: borra trazos y texto
const BLUR_RADIUS = 5; // suaviza el mapa para que no queden bloques
const BLUR_PASSES = 2;
const MIN_ILLUMINATION = 40; // evita dividir por casi cero en zonas muy oscuras

/**
 * Corrección de sombras y luz desigual (idea tipo Retinex), que es lo que más
 * "contraste" aporta a un documento fotografiado:
 *
 *  1. Se estima la iluminación del papel: el fondo claro local (máximo por bloques,
 *     dilatación y desenfoque), de modo que el texto desaparece del mapa.
 *  2. Cada píxel se multiplica por 255 / iluminación local: el papel pasa a ser blanco
 *     uniforme y las sombras se eliminan, mientras que el texto conserva su oscuridad relativa.
 *
 * Opciones: `strength` 0-100 (%) = mezcla entre la imagen original y la corregida.
 */
export class IlluminationFilter extends ImageFilter {
  get id() {
    return 'illumination';
  }

  isActive(options) {
    return options.strength > 0;
  }

  apply(image, options) {
    const strength = clamp(options.strength, 0, 100) / 100;
    const { width, height, data } = image;

    const luma = extractLuma(image);
    const factor = Math.max(1, Math.ceil(Math.max(width, height) / ESTIMATE_SIDE));
    let plane = downscaleMax(luma, width, height, factor);
    plane = maxFilter(plane, DILATE_RADIUS);
    plane = boxBlur(plane, BLUR_RADIUS, BLUR_PASSES);
    const illumination = upscaleBilinear(plane, width, height);

    for (let p = 0, i = 0; p < illumination.length; p++, i += 4) {
      const fullGain = 255 / Math.max(illumination[p], MIN_ILLUMINATION);
      const gain = 1 + (fullGain - 1) * strength;
      data[i] *= gain;
      data[i + 1] *= gain;
      data[i + 2] *= gain;
    }
    return image;
  }
}
