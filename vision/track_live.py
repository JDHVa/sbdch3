"""
Rastreo del balín EN VIVO (webcam, tiempo real) — para probar el modelo.

Abre la cámara, detecta el balín (forma circular con Hough, o color), dibuja un
bounding box que lo sigue, la traza y la rapidez instantánea. Reutiliza la misma
lógica de detección que `track_marble.py`.

Teclas:  q = salir   c = limpiar traza   espacio = pausa

Ejemplos:
  # Webcam por defecto
  python track_live.py

  # Rapidez en m/s reales (da el diámetro del balín) y energía (da la masa)
  python track_live.py --ball-diameter-m 0.016 --mass 0.028

  # Balín de color muy contrastante
  python track_live.py --method color --hsv-lo 35 80 80 --hsv-hi 85 255 255

  # Probar el modelo sobre un archivo (en vez de la webcam)
  python track_live.py --source samples/marble_run.mp4

  # Prueba sin ventana (para verificar que corre, imprime detecciones)
  python track_live.py --source samples/marble_run.mp4 --no-gui --max-frames 60
"""

from __future__ import annotations

import argparse
import time
from collections import deque

import cv2
import numpy as np

from track_marble import detect_color, detect_hough, make_tracker, pick_circle


def open_source(src: str) -> cv2.VideoCapture:
    """Abre webcam (índice numérico) o un archivo de video (ruta)."""
    if src.isdigit():
        # En Windows, CAP_DSHOW abre la webcam más rápido y sin cuelgues.
        cap = cv2.VideoCapture(int(src), cv2.CAP_DSHOW)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    else:
        cap = cv2.VideoCapture(src)
    return cap


def main():
    p = argparse.ArgumentParser(description="Rastreo del balín en vivo (webcam).")
    p.add_argument("--source", default="0", help="Índice de cámara (0,1,...) o ruta de video.")
    p.add_argument("--method", choices=["hough", "color"], default="hough")
    p.add_argument("--select", action="store_true",
                   help="Marca TÚ el balín con el mouse en el primer cuadro; un tracker lo sigue "
                        "(lo más robusto para balín metálico; ignora Hough).")
    p.add_argument("--min-radius", type=int, default=12)
    p.add_argument("--max-radius", type=int, default=90)
    p.add_argument("--hough-param2", type=int, default=45,
                   help="Umbral de Hough: más alto = menos círculos falsos (puntos/reflejos).")
    p.add_argument("--max-jump", type=float, default=0, help="Salto máx entre cuadros (px). 0 = 25% del ancho.")
    p.add_argument("--hsv-lo", type=int, nargs=3, default=[35, 80, 80])
    p.add_argument("--hsv-hi", type=int, nargs=3, default=[85, 255, 255])
    p.add_argument("--ball-diameter-m", type=float, default=None, help="Diámetro real (m) para rapidez en m/s.")
    p.add_argument("--scale", type=float, default=None, help="Metros por píxel (alternativa a --ball-diameter-m).")
    p.add_argument("--mass", type=float, default=None, help="Masa (kg) para mostrar energía cinética.")
    p.add_argument("--record", default=None, help="Guardar el video anotado en esta ruta (mp4).")
    p.add_argument("--no-gui", action="store_true", help="No abrir ventana (modo prueba).")
    p.add_argument("--max-frames", type=int, default=0, help="Procesar como máximo N cuadros (0 = sin límite).")
    args = p.parse_args()

    cap = open_source(args.source)
    if not cap.isOpened():
        raise SystemExit(
            f"No se pudo abrir la fuente '{args.source}'. "
            "¿La webcam está conectada / la ruta existe? Prueba --source 1."
        )

    color_lo = np.array(args.hsv_lo, np.uint8)
    color_hi = np.array(args.hsv_hi, np.uint8)

    trail: deque[tuple[int, int]] = deque(maxlen=64)
    last_center: tuple[float, float] | None = None
    last_time: float | None = None
    speed_px = 0.0        # px/s suavizado
    smooth_r = 0.0        # radio suavizado
    tracker = None
    last_pos: tuple[float, float] | None = None

    writer = None
    fps_ema = 0.0
    paused = False
    frames = 0

    # Modo selección: el usuario marca el balín una vez y el tracker lo sigue.
    if args.select:
        if args.no_gui:
            raise SystemExit("--select necesita ventana (no uses --no-gui).")
        ok, first = cap.read()
        if not ok:
            raise SystemExit("No se pudo leer el primer cuadro para seleccionar el balín.")
        win = "Marca el balin con el mouse y ENTER (ESC=cancelar)"
        box = cv2.selectROI(win, first, showCrosshair=False)
        cv2.destroyWindow(win)
        if box == (0, 0, 0, 0):
            raise SystemExit("Selección cancelada.")
        tracker = make_tracker()
        if tracker is None:
            raise SystemExit("Tu OpenCV no trae el tracker CSRT; usa el modo Hough sin --select.")
        tracker.init(first, tuple(int(v) for v in box))
        bx, by, bw, bh = box
        last_pos = (bx + bw / 2, by + bh / 2)
        smooth_r = (bw + bh) / 4
        print("[info] balín seleccionado; el tracker lo seguirá.")

    print("[info] q=salir  c=limpiar  espacio=pausa")

    while True:
        if not paused:
            ok, frame = cap.read()
            if not ok:
                break
            frames += 1
            now = time.perf_counter()

            h, w = frame.shape[:2]
            max_jump = args.max_jump if args.max_jump else w * 0.25

            # --- Detección ---
            if args.select:
                candidates = []  # solo tracker (el balín lo marcaste tú)
            elif args.method == "color":
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                one = detect_color(hsv, color_lo, color_hi)
                candidates = [one] if one is not None else []
            else:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                candidates = detect_hough(gray, args.min_radius, args.max_radius, args.hough_param2)

            det = pick_circle(candidates, last_pos, max_jump)

            if det is not None:
                x, y, r = det
                last_pos = (x, y)
                tr = make_tracker()
                if tr is not None:
                    tr.init(frame, (int(x - r), int(y - r), int(2 * r), int(2 * r)))
                    tracker = tr
            elif tracker is not None:
                ok2, box = tracker.update(frame)
                if ok2:
                    bx, by, bw, bh = box
                    x, y, r = bx + bw / 2, by + bh / 2, (bw + bh) / 4
                    if last_pos and np.hypot(x - last_pos[0], y - last_pos[1]) > max_jump:
                        x = y = None  # salto imposible
                        tracker = None
                    else:
                        last_pos = (x, y)
                else:
                    x = y = None
                    tracker = None
            else:
                x = y = None

            # --- Física instantánea ---
            found = x is not None and np.isfinite(x)
            if found:
                smooth_r = 0.7 * smooth_r + 0.3 * r if smooth_r else r
                if last_center is not None and last_time is not None:
                    dt = now - last_time
                    if dt > 1e-4:
                        d = np.hypot(x - last_center[0], y - last_center[1])
                        inst = d / dt
                        speed_px = 0.6 * speed_px + 0.4 * inst  # EMA
                last_center = (x, y)
                last_time = now
                trail.append((int(x), int(y)))
            else:
                # Sin detección: la rapidez decae hacia 0.
                speed_px *= 0.9

            # Calibración -> unidades reales
            if args.scale:
                scale = args.scale
            elif args.ball_diameter_m and smooth_r > 1:
                scale = args.ball_diameter_m / (2 * smooth_r)
            else:
                scale = None
            if scale:
                speed_val, unit = speed_px * scale, "m/s"
            else:
                speed_val, unit = speed_px, "px/s"

            # FPS
            if last_time is not None:
                pass
            fps_now = 1.0 / max(1e-3, (now - getattr(main, "_prev", now)))
            main._prev = now  # type: ignore[attr-defined]
            fps_ema = 0.9 * fps_ema + 0.1 * fps_now if fps_ema else fps_now

            # --- Dibujo ---
            for i in range(1, len(trail)):
                cv2.line(frame, trail[i - 1], trail[i], (0, 200, 255), 2)

            if found:
                bx = int(x - smooth_r * 1.4)
                by = int(y - smooth_r * 1.4)
                bs = int(smooth_r * 2.8)
                cv2.rectangle(frame, (bx, by), (bx + bs, by + bs), (0, 255, 100), 2)
                cv2.circle(frame, (int(x), int(y)), 3, (0, 0, 255), -1)
                label = f"balin  v={speed_val:.2f} {unit}"
                if args.mass and scale:
                    ke = 0.5 * args.mass * (speed_px * scale) ** 2
                    label += f"  KE={ke:.3f} J"
                cv2.rectangle(frame, (bx, by - 22), (bx + max(150, 9 * len(label)), by), (0, 255, 100), -1)
                cv2.putText(frame, label, (bx + 4, by - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (10, 30, 10), 2)
            else:
                cv2.putText(frame, "buscando balin...", (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 200, 255), 2)

            cv2.putText(frame, f"{fps_ema:4.1f} FPS", (12, h - 14), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            if not scale:
                cv2.putText(frame, "sin calibrar (px). usa --ball-diameter-m", (12, h - 40),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

            if args.record:
                if writer is None:
                    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                    writer = cv2.VideoWriter(args.record, fourcc, 30, (w, h))
                writer.write(frame)

            if args.no_gui:
                if frames % 15 == 0:
                    print(f"[{frames:4d}] found={found} v={speed_val:7.2f} {unit} fps={fps_ema:.1f}")
                if args.max_frames and frames >= args.max_frames:
                    break
                continue

        if not args.no_gui:
            cv2.imshow("Rastreo del balin (en vivo)  -  q=salir  c=limpiar  espacio=pausa", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("c"):
                trail.clear()
            if key == ord(" "):
                paused = not paused

        if args.max_frames and frames >= args.max_frames:
            break

    cap.release()
    if writer is not None:
        writer.release()
    if not args.no_gui:
        cv2.destroyAllWindows()
    print(f"[fin] {frames} cuadros procesados.")


if __name__ == "__main__":
    main()
