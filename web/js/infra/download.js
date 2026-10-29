// @ts-check

/**
 * Descarga un Blob como archivo.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Nombre de archivo con fecha y hora locales: `scan-20261029-101530.png`.
 * @param {string} extension
 * @param {Date} [now]
 */
export function timestampedName(extension, now = new Date()) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const time = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `scan-${date}-${time}.${extension}`;
}
