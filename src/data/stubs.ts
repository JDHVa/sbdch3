/**
 * Stubs de las fuentes de datos reales (futuras). No implementan la conexión
 * todavía; documentan cómo se conectará cada una para no bloquear la arquitectura.
 */

import type { CoasterDataSource, Sample } from './DataSource';

const notReady = (name: string) => () => {
  throw new Error(`${name}: aún no implementado. Ver comentarios para la ruta futura.`);
};

/**
 * ESP32 / Arduino por USB usando la Web Serial API.
 * Futuro: navigator.serial.requestPort(), abrir a 115200 baudios, leer líneas
 * "s,v" o tiempos entre sensores IR y convertirlos a rapidez.
 */
export const serialSource: CoasterDataSource = {
  kind: 'serial',
  label: 'Sensores ESP32 (USB)',
  available: false,
  connect: notReady('SerialSource'),
  disconnect: () => {},
  onSample: (_cb: (s: Sample) => void) => () => {},
};

/**
 * ESP32 por WiFi usando WebSocket.
 * Futuro: new WebSocket('ws://<ip-esp32>/telemetry'), parsear JSON {t, s, v}.
 */
export const webSocketSource: CoasterDataSource = {
  kind: 'websocket',
  label: 'Sensores ESP32 (WiFi)',
  available: false,
  connect: notReady('WebSocketSource'),
  disconnect: () => {},
  onSample: (_cb: (s: Sample) => void) => () => {},
};

/**
 * Video / cámara: tracking de la canica con OpenCV.js o MediaPipe (o CSV
 * generado offline con Python + OpenCV). Requiere calibración píxeles→metros.
 * Futuro: getUserMedia() + detección de blob de color por frame → v = Δpos/Δt.
 */
export const videoSource: CoasterDataSource = {
  kind: 'video',
  label: 'Video / cámara (tracking)',
  available: false,
  connect: notReady('VideoSource'),
  disconnect: () => {},
  onSample: (_cb: (s: Sample) => void) => () => {},
};

export const futureSources: CoasterDataSource[] = [serialSource, webSocketSource, videoSource];
