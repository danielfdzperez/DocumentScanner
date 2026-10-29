// @ts-check
import { defaultCorners, rotatePointQuarter } from '../core/geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const KEY_STEP = 0.005; // 0,5 % del tamaño por pulsación de flecha
const KEY_STEP_BIG = 0.02; // con Mayús

/**
 * Editor de las 4 esquinas de recorte. Se dibuja encima de la vista previa:
 * un contenedor con la misma caja que el canvas, con 4 tiradores arrastrables
 * (ratón, táctil o teclado) y el contorno del cuadrilátero.
 *
 * Las posiciones son normalizadas (0-1) respecto a la imagen mostrada.
 */
export class CropEditor {
  /**
   * @param {object} deps
   * @param {HTMLElement} deps.container caja con la misma posición y tamaño que el canvas
   * @param {import('../core/contracts.js').Translator} deps.translator
   */
  constructor({ container, translator }) {
    this.container = container;
    this.translator = translator;
    /** @type {import('../core/geometry.js').Point[]} */
    this.corners = defaultCorners();
    this.active = false;

    this.root = document.createElement('div');
    this.root.className = 'crop';
    this.root.hidden = true;

    this.svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, 'svg'));
    this.svg.setAttribute('viewBox', '0 0 100 100');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.svg.setAttribute('aria-hidden', 'true');
    this.mask = document.createElementNS(SVG_NS, 'path');
    this.mask.setAttribute('class', 'crop__mask');
    this.mask.setAttribute('fill-rule', 'evenodd');
    this.outline = document.createElementNS(SVG_NS, 'polygon');
    this.outline.setAttribute('class', 'crop__outline');
    this.svg.append(this.mask, this.outline);
    this.root.append(this.svg);

    /** @type {HTMLElement[]} */
    this.handles = this.corners.map((_, index) => this.createHandle(index));
    this.root.append(...this.handles);
    container.append(this.root);
  }

  /** Muestra el editor con las esquinas indicadas (o las de por defecto). @param {import('../core/geometry.js').Point[]} [corners] */
  show(corners = defaultCorners()) {
    this.corners = corners.map((p) => ({ ...p }));
    this.active = true;
    this.root.hidden = false;
    this.redraw();
  }

  hide() {
    this.active = false;
    this.root.hidden = true;
  }

  /** @returns {import('../core/geometry.js').Point[]} copia de las esquinas */
  getCorners() {
    return this.corners.map((p) => ({ ...p }));
  }

  /** Gira los puntos con la imagen. @param {1 | -1} direction */
  rotate(direction) {
    this.corners = this.corners.map((p) => rotatePointQuarter(p, direction));
    this.redraw();
  }

  /** @param {number} index */
  createHandle(index) {
    const handle = document.createElement('div');
    handle.className = 'crop__handle';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', this.translator.t('crop.handle', { n: index + 1 }));

    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      const rect = this.container.getBoundingClientRect();
      this.moveTo(index, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    });
    const release = (/** @type {PointerEvent} */ event) => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      handle.classList.remove('is-dragging');
    };
    handle.addEventListener('pointerup', release);
    handle.addEventListener('pointercancel', release);

    handle.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? KEY_STEP_BIG : KEY_STEP;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[
        event.key
      ];
      if (!delta) return;
      event.preventDefault();
      const p = this.corners[index];
      this.moveTo(index, p.x + delta[0], p.y + delta[1]);
    });
    return handle;
  }

  /** @param {number} index @param {number} x @param {number} y */
  moveTo(index, x, y) {
    this.corners[index] = { x: clamp01(x), y: clamp01(y) };
    this.redraw();
  }

  redraw() {
    const pts = this.corners.map((p) => `${p.x * 100},${p.y * 100}`);
    this.outline.setAttribute('points', pts.join(' '));
    this.mask.setAttribute('d', `M0 0H100V100H0Z M${pts.join(' L')}Z`);
    this.corners.forEach((p, i) => {
      this.handles[i].style.left = `${p.x * 100}%`;
      this.handles[i].style.top = `${p.y * 100}%`;
      this.handles[i].setAttribute('aria-valuetext', `${Math.round(p.x * 100)} %, ${Math.round(p.y * 100)} %`);
    });
  }
}

/** @param {number} v */
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
