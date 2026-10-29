// @ts-check
import { cropPerspective, resizeToFit, rotateQuarter } from '../core/geometry.js';
import { CONTROLS, DEFAULT_PRESET_ID, PRESETS } from '../core/settings.js';
import { CameraError } from '../infra/camera-frame-source.js';
import { paint } from '../infra/canvas-utils.js';
import { downloadBlob, timestampedName } from '../infra/download.js';
import { ControlsPanel } from './controls-panel.js';
import { CropEditor } from './crop-editor.js';

/** Tamaños de trabajo (lado mayor, en píxeles). */
export const LIMITS = Object.freeze({
  preview: 1280, // lo que se procesa mientras se mueven los sliders
  full: 3200, // lo que se procesa al descargar
  live: 640, // cada fotograma de la cámara en directo
  liveIntervalMs: 80, // ~12 fps máximo
});

/** @typedef {import('../core/image-buffer.js').ImageBuffer} ImageBuffer */

/**
 * Controlador de la pantalla. Solo conoce los contratos del núcleo; las implementaciones
 * concretas (cámara, archivo, exportador) le llegan por el constructor.
 */
export class App {
  /**
   * @param {object} deps
   * @param {Document} deps.document
   * @param {import('../core/contracts.js').Translator} deps.translator
   * @param {import('../core/pipeline.js').Pipeline} deps.pipeline
   * @param {import('../core/contracts.js').ImageExporter} deps.exporter
   * @param {(file: File) => Promise<import('../core/contracts.js').FrameSource>} deps.openFile
   * @param {(video: HTMLVideoElement) => Promise<import('../core/contracts.js').FrameSource>} deps.openCamera
   */
  constructor({ document: doc, translator, pipeline, exporter, openFile, openCamera }) {
    this.t = translator;
    this.pipeline = pipeline;
    this.exporter = exporter;
    this.openFile = openFile;
    this.openCamera = openCamera;

    const $ = (/** @type {string} */ id) => {
      const el = doc.getElementById(id);
      if (!el) throw new Error(`Falta el elemento #${id}`);
      return el;
    };
    this.el = {
      stage: $('stage'),
      canvas: /** @type {HTMLCanvasElement} */ ($('preview')),
      empty: $('empty-state'),
      live: $('live-badge'),
      video: /** @type {HTMLVideoElement} */ ($('camera-video')),
      fileInput: /** @type {HTMLInputElement} */ ($('file-input')),
      open: $('btn-open'),
      camera: $('btn-camera'),
      capture: $('btn-capture'),
      original: $('btn-original'),
      download: $('btn-download'),
      reset: $('btn-reset'),
      format: /** @type {HTMLSelectElement} */ ($('format')),
      status: $('status'),
      stageView: $('stage-view'),
      editTools: $('edit-tools'),
      rotateLeft: $('btn-rotate-left'),
      rotateRight: $('btn-rotate-right'),
      crop: $('btn-crop'),
      applyCrop: $('btn-apply-crop'),
      cancelCrop: $('btn-cancel-crop'),
      restore: $('btn-restore'),
    };

    /** @type {'empty' | 'live' | 'image'} */
    this.mode = 'empty';
    /** @type {import('../core/contracts.js').FrameSource | null} */
    this.cameraSource = null;
    /** @type {ImageBuffer | null} */ this.fullImage = null;
    /** @type {ImageBuffer | null} */ this.previewImage = null;
    /** Imagen tal como se cargó, para poder deshacer giros y recortes. */
    /** @type {{ full: ImageBuffer, preview: ImageBuffer } | null} */
    this.base = null;
    this.cropping = false;
    this.showOriginal = false;
    this.renderQueued = false;
    this.liveTimer = 0;

    this.panel = new ControlsPanel({
      presetsContainer: $('presets'),
      slidersContainer: $('sliders'),
      translator,
      controls: CONTROLS,
      presets: PRESETS,
      onChange: () => this.requestRender(),
    });

    this.cropEditor = new CropEditor({ container: this.el.stageView, translator });

    this.bindEvents();
    this.panel.selectPreset(DEFAULT_PRESET_ID);
    this.updateUi();
  }

  // ---- Eventos -----------------------------------------------------------------------------

  bindEvents() {
    const { el } = this;
    el.open.addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', () => {
      const file = el.fileInput.files?.[0];
      el.fileInput.value = ''; // permite volver a elegir el mismo archivo
      if (file) void this.guard(() => this.loadFile(file));
    });
    el.camera.addEventListener('click', () =>
      void this.guard(() => (this.mode === 'live' ? this.stopCamera() : this.startCamera())),
    );
    el.capture.addEventListener('click', () => void this.guard(() => this.takePhoto()));
    el.original.addEventListener('click', () => {
      this.showOriginal = !this.showOriginal;
      this.updateUi();
      this.requestRender();
    });
    el.reset.addEventListener('click', () => this.panel.selectPreset(DEFAULT_PRESET_ID));
    el.rotateLeft.addEventListener('click', () => this.rotate(-1));
    el.rotateRight.addEventListener('click', () => this.rotate(1));
    el.crop.addEventListener('click', () => this.startCrop());
    el.cancelCrop.addEventListener('click', () => this.endCrop());
    el.applyCrop.addEventListener('click', () => void this.guard(() => this.applyCrop()));
    el.restore.addEventListener('click', () => this.restoreOriginal());
    el.download.addEventListener('click', () => void this.guard(() => this.download()));

    el.stage.addEventListener('dragover', (event) => {
      event.preventDefault();
      el.stage.classList.add('is-dragging');
    });
    el.stage.addEventListener('dragleave', () => el.stage.classList.remove('is-dragging'));
    el.stage.addEventListener('drop', (event) => {
      event.preventDefault();
      el.stage.classList.remove('is-dragging');
      const file = event.dataTransfer?.files?.[0];
      if (file) void this.guard(() => this.loadFile(file));
    });
  }

  // ---- Acciones ----------------------------------------------------------------------------

  /** @param {File} file */
  async loadFile(file) {
    if (!file.type.startsWith('image/')) throw new UserError('errors.notAnImage');
    this.setStatus('status.processing');
    await this.stopCamera();

    let source;
    try {
      source = await this.openFile(file);
    } catch {
      throw new UserError('errors.imageLoad');
    }
    try {
      const [full, preview] = await Promise.all([source.grab(LIMITS.full), source.grab(LIMITS.preview)]);
      this.setImage(full, preview);
      this.setStatus('status.loaded', { width: full.width, height: full.height });
    } finally {
      source.dispose();
    }
  }

  async startCamera() {
    this.setStatus('status.processing');
    try {
      this.cameraSource = await this.openCamera(this.el.video);
    } catch (error) {
      throw new UserError(cameraErrorKey(error));
    }
    this.mode = 'live';
    this.showOriginal = false;
    this.clearStatus();
    this.updateUi();
    this.liveLoop();
  }

  async stopCamera() {
    clearTimeout(this.liveTimer);
    this.cameraSource?.dispose();
    this.cameraSource = null;
    if (this.mode === 'live') {
      this.mode = this.fullImage ? 'image' : 'empty';
      this.updateUi();
      this.requestRender();
    }
  }

  async takePhoto() {
    const camera = this.cameraSource;
    if (!camera || this.mode !== 'live') return;
    // Ambas lecturas se hacen en el mismo instante para que sean el mismo fotograma.
    const [full, preview] = await Promise.all([camera.grab(LIMITS.full), camera.grab(LIMITS.preview)]);
    await this.stopCamera();
    this.setImage(full, preview);
  }

  async download() {
    if (!this.fullImage) return;
    const format = this.el.format.value === 'jpeg' ? 'jpeg' : 'png';
    this.setStatus('status.processing');
    await nextFrame(); // deja pintar el aviso antes de bloquear el hilo con el procesado
    const result = this.pipeline.run(this.fullImage, this.panel.getSettings());
    let blob;
    try {
      blob = await this.exporter.export(result, { format, quality: 0.92 });
    } catch {
      throw new UserError('errors.export');
    }
    const name = timestampedName(format === 'jpeg' ? 'jpg' : 'png');
    downloadBlob(blob, name);
    this.setStatus('status.saved', { name });
  }

  // ---- Geometría: giro y recorte -----------------------------------------------------------

  /** Gira la imagen (y los puntos de recorte si se está recortando). @param {1 | -1} direction */
  rotate(direction) {
    if (!this.fullImage || !this.previewImage) return;
    this.fullImage = rotateQuarter(this.fullImage, direction);
    this.previewImage = rotateQuarter(this.previewImage, direction);
    if (this.cropping) this.cropEditor.rotate(direction);
    this.updateUi();
    this.requestRender();
  }

  startCrop() {
    if (this.mode !== 'image') return;
    this.cropping = true;
    this.cropEditor.show();
    this.setStatus('status.cropHint');
    this.updateUi();
    this.requestRender();
  }

  endCrop() {
    this.cropping = false;
    this.cropEditor.hide();
    this.clearStatus();
    this.updateUi();
    this.requestRender();
  }

  /** Recorta y endereza lo que queda dentro de los 4 puntos. */
  async applyCrop() {
    if (!this.fullImage) return;
    const corners = this.cropEditor.getCorners();
    let full;
    try {
      full = cropPerspective(this.fullImage, corners);
    } catch {
      throw new UserError('errors.cropInvalid');
    }
    this.fullImage = full;
    this.previewImage = resizeToFit(full, LIMITS.preview);
    this.endCrop();
  }

  restoreOriginal() {
    if (!this.base) return;
    this.fullImage = this.base.full;
    this.previewImage = this.base.preview;
    this.endCrop();
  }

  /** @param {ImageBuffer} full @param {ImageBuffer} preview */
  setImage(full, preview) {
    this.fullImage = full;
    this.previewImage = preview;
    this.base = { full, preview };
    this.cropping = false;
    this.cropEditor.hide();
    this.mode = 'image';
    this.showOriginal = false;
    this.updateUi();
    this.requestRender();
  }

  // ---- Dibujado ----------------------------------------------------------------------------

  /** Agrupa varios cambios seguidos (p. ej. mover un slider) en un solo dibujado. */
  requestRender() {
    if (this.renderQueued || this.mode !== 'image') return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (this.mode !== 'image' || !this.previewImage) return;
      const image = this.showOriginal || this.cropping
        ? this.previewImage
        : this.pipeline.run(this.previewImage, this.panel.getSettings());
      paint(image, this.el.canvas);
    });
  }

  liveLoop() {
    const camera = this.cameraSource;
    if (!camera || this.mode !== 'live') return;
    const started = performance.now();
    camera
      .grab(LIMITS.live)
      .then((frame) => {
        if (this.mode !== 'live') return;
        const image = this.showOriginal ? frame : this.pipeline.run(frame, this.panel.getSettings());
        paint(image, this.el.canvas);
      })
      .catch(() => {})
      .finally(() => {
        if (this.mode !== 'live') return;
        const wait = Math.max(0, LIMITS.liveIntervalMs - (performance.now() - started));
        this.liveTimer = window.setTimeout(() => this.liveLoop(), wait);
      });
  }

  // ---- Interfaz ----------------------------------------------------------------------------

  updateUi() {
    const { el, mode } = this;
    const hasImage = mode === 'image';
    el.canvas.hidden = mode === 'empty';
    el.empty.hidden = mode !== 'empty';
    el.live.hidden = mode !== 'live';
    el.capture.hidden = mode !== 'live';
    el.camera.textContent = this.t.t(mode === 'live' ? 'actions.stopCamera' : 'actions.camera');
    const { cropping } = this;
    el.download.toggleAttribute('disabled', !hasImage || cropping);
    el.original.toggleAttribute('disabled', mode === 'empty' || cropping);
    el.editTools.hidden = !hasImage;
    el.crop.hidden = cropping;
    el.applyCrop.hidden = !cropping;
    el.cancelCrop.hidden = !cropping;
    const edited = this.base !== null && (this.fullImage !== this.base.full);
    el.restore.toggleAttribute('disabled', !edited);
    el.original.setAttribute('aria-pressed', String(this.showOriginal));
  }

  /** @param {string} key @param {Record<string, string | number>} [params] */
  setStatus(key, params) {
    this.el.status.dataset.kind = 'info';
    this.el.status.textContent = this.t.t(key, params);
  }

  clearStatus() {
    this.el.status.textContent = '';
  }

  /** @param {string} key */
  setError(key) {
    this.el.status.dataset.kind = 'error';
    this.el.status.textContent = this.t.t(key);
  }

  /**
   * Ejecuta una acción mostrando como mensaje cualquier error esperable.
   * @param {() => Promise<void>} action
   */
  async guard(action) {
    try {
      await action();
    } catch (error) {
      if (error instanceof UserError) this.setError(error.key);
      else {
        console.error(error);
        this.setError('errors.generic');
      }
    }
  }
}

/** Error cuyo mensaje es una clave de traducción apta para mostrar al usuario. */
class UserError extends Error {
  /** @param {string} key */
  constructor(key) {
    super(key);
    this.key = key;
  }
}

/** @param {unknown} error */
function cameraErrorKey(error) {
  const code = error instanceof CameraError ? error.code : 'failed';
  return { unsupported: 'errors.cameraUnsupported', denied: 'errors.cameraDenied', notFound: 'errors.cameraNotFound' }[
    /** @type {'unsupported' | 'denied' | 'notFound'} */ (code)
  ] ?? 'errors.cameraFailed';
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}
