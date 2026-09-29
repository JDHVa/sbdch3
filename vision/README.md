# 🎥 Análisis por video (sin sensores)

Rastrea un balín circular en un video y calcula su física (velocidad, energía
cinética y potencial) usando **visión por computadora clásica (OpenCV)** — sin
sensores y sin modelos de IA pesados.

## Instalación

Ya hay un entorno virtual creado en `vision/.venv`. Para usarlo:

```powershell
# Desde la carpeta vision/
.venv\Scripts\python.exe track_marble.py --help
```

Si necesitas recrearlo:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Uso

```powershell
.venv\Scripts\python.exe track_marble.py --video samples/ball3.mp4 --method hough --max-jump 120
```

Con tu balín real (para obtener **metros y m/s reales**), da el diámetro del
balín y su masa:

```powershell
.venv\Scripts\python.exe track_marble.py `
  --video mi_video.mp4 `
  --method hough `
  --ball-diameter-m 0.016 `   # diámetro real del balín (16 mm)
  --mass 0.028 `              # masa (kg)
  --max-jump 120
```

Balín de color muy contrastante → usa `--method color` (ajusta `--hsv-lo`/`--hsv-hi`).

## Opciones principales

| Opción | Para qué |
|---|---|
| `--video` | Ruta del video de entrada. |
| `--method hough\|color` | Detección por forma (balín metálico) o color (HSV). |
| `--ball-diameter-m` | Diámetro real del balín → autocalibra px→m. |
| `--scale` | Metros por píxel, si ya lo conoces (alternativa a la anterior). |
| `--mass` | Masa del balín (kg) para la energía. |
| `--max-jump` | Salto máx. plausible entre cuadros (px); rechaza detecciones falsas. |
| `--min-radius`/`--max-radius` | Rango de radio del balín en píxeles. |
| `--smooth-window` | Ventana del filtro Savitzky-Golay (impar). |
| `--no-overlay` | No generar el video con overlay (más rápido). |

## Salidas (en `out/`)

- `*_trayectoria.csv` — t, posición, altura, velocidad, rapidez y energías.
- `*_graficas.png` — trayectoria, rapidez vs t, energía vs t.
- `*_overlay.mp4` — el video con el balín marcado, su traza y la rapidez.

## Cómo grabar para buenos resultados

- 📷 **Cámara fija** (tripié), de **lado** y perpendicular al plano de la pista.
- 🎞️ **FPS altos**: usa **cámara lenta** del celular (120/240 fps) — menos borrón.
- 💡 **Buena luz** y balín **contrastante** con el fondo.
- 📏 Ten una **referencia de tamaño** o usa `--ball-diameter-m` para calibrar.

## Cómo funciona

1. Detección por Transformada de Hough (forma circular) cuadro a cuadro; se elige
   el círculo más cercano al anterior y se rechazan saltos imposibles
   (`--max-jump`). Un tracker CSRT puentea oclusiones (p. ej. en el rizo).
2. Calibración px→m por el diámetro real del balín.
3. Suavizado Savitzky-Golay + derivación numérica → velocidad y rapidez.
4. Energías: `KE = ½ m v²`, `PE = m g h`.

## Siguiente paso (integración con el app web)

El CSV está pensado para alimentar el modo `VideoSource` del simulador web y
**sobreponer la curva real sobre la teórica**. Eso es la fase 2.
