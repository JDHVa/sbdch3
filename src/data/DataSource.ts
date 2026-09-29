/**
 * Capa de datos abstracta.
 *
 * Toda fuente de datos (simulación, sensores Arduino/ESP32, video) implementa la
 * misma interfaz, de modo que la app pueda cambiar entre "datos teóricos" y
 * "datos reales" sin rediseñar nada. Hoy solo se usa la fuente simulada; los
 * demás quedan como stubs documentados para el futuro.
 */

import type { Vec3 } from '../physics';

export type DataSourceKind = 'simulated' | 'serial' | 'websocket' | 'video';

/** Una muestra de datos: instante y (según la fuente) posición y/o rapidez. */
export interface Sample {
  /** Tiempo (s). */
  t: number;
  /** Longitud de arco sobre la pista (m), si la fuente la conoce. */
  s?: number;
  /** Rapidez medida (m/s). */
  speed?: number;
  /** Posición 3D medida (m). */
  position?: Vec3;
}

export interface CoasterDataSource {
  readonly kind: DataSourceKind;
  /** Etiqueta legible para la UI. */
  readonly label: string;
  /** ¿Está lista para usarse en esta versión? */
  readonly available: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  /** Suscribe un callback a las muestras entrantes. Devuelve la función para desuscribir. */
  onSample(cb: (sample: Sample) => void): () => void;
}
