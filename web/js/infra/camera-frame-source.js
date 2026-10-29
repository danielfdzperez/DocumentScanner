// @ts-check
import { FrameSource } from '../core/contracts.js';
import { rasterize } from './canvas-utils.js';

/** Error de cámara con un código estable que la interfaz traduce. */
export class CameraError extends Error {
  /** @param {'unsupported' | 'denied' | 'notFound' | 'failed'} code @param {unknown} [cause] */
  constructor(code, cause) {
    super(`Cámara: ${code}`);
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Origen de imagen a partir de la cámara (getUserMedia). Requiere HTTPS o localhost.
 */
export class CameraFrameSource extends FrameSource {
  /**
   * @param {MediaStream} stream
   * @param {HTMLVideoElement} video elemento (no tiene por qué verse) que reproduce el stream
   */
  constructor(stream, video) {
    super();
    this.stream = stream;
    this.video = video;
  }

  /**
   * Pide permiso, abre la cámara trasera si existe y espera al primer fotograma.
   * @param {HTMLVideoElement} video
   * @returns {Promise<CameraFrameSource>}
   */
  static async open(video) {
    if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch (error) {
      throw new CameraError(classify(error), error);
    }
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try {
      await video.play();
      await waitForFrame(video);
    } catch (error) {
      for (const track of stream.getTracks()) track.stop();
      throw new CameraError('failed', error);
    }
    return new CameraFrameSource(stream, video);
  }

  grab(maxSide) {
    const { videoWidth, videoHeight } = this.video;
    return Promise.resolve(rasterize(this.video, videoWidth, videoHeight, maxSide));
  }

  dispose() {
    for (const track of this.stream.getTracks()) track.stop();
    this.video.srcObject = null;
  }
}

/** @param {unknown} error @returns {'denied' | 'notFound' | 'failed'} */
function classify(error) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notFound';
  return 'failed';
}

/** @param {HTMLVideoElement} video */
function waitForFrame(video) {
  if (video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout')), 8000);
    video.addEventListener(
      'loadeddata',
      () => {
        clearTimeout(timeout);
        resolve(undefined);
      },
      { once: true },
    );
  });
}
