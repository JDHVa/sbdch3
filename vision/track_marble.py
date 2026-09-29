"""
Rastrea un balín (objeto circular) en un video y calcula su física
(velocidad, energía cinética y potencial) — sin sensores.

Pipeline:
  1. Detección por FORMA (Transformada de Hough) cuadro a cuadro; un tracker
     CSRT puente cubre los cuadros donde el balín se ocluye (p. ej. en el rizo).
  2. Calibración píxeles → metros (por el diámetro real del balín, o --scale).
  3. Suavizado (Savitzky-Golay) y derivación → velocidad y rapidez.
  4. Energías: KE = ½ m v²,  PE = m g h.
  5. Salidas: CSV, video con overlay y gráficas PNG.

Uso típico:
  python track_marble.py --video samples/ball3.mp4 --ball-diameter-m 0.016 --mass 0.028

Ver README.md para más opciones.
"""

from __future__ import annotations

import argparse
import csv
import os
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class Detection:
    frame: int
    t: float
    x: float      # px
    y: float      # px (hacia abajo en la imagen)
    r: float      # px
    found: bool   # True = detección real; False = interpolado / tracker


# --------------------------------------------------------------------------- #
# Detección
# --------------------------------------------------------------------------- #

def detect_hough(gray: np.ndarray, min_r: int, max_r: int) -> list[tuple[float, float, float]]:
    """Devuelve todos los círculos candidatos (ordenados por fuerza)."""
    blurred = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=gray.shape[0] / 4,
        param1=120,
        param2=30,
        minRadius=min_r,
        maxRadius=max_r,
    )
    if circles is None:
        return []
    return [(float(x), float(y), float(r)) for x, y, r in circles[0]]


def pick_circle(
    candidates: list[tuple[float, float, float]],
    last: tuple[float, float] | None,
    max_jump: float,
) -> tuple[float, float, float] | None:
    """Elige el círculo más cercano a la última posición (rechaza saltos imposibles)."""
    if not candidates:
        return None
    if last is None:
        return candidates[0]  # el más fuerte
    lx, ly = last
    best = min(candidates, key=lambda c: (c[0] - lx) ** 2 + (c[1] - ly) ** 2)
    if np.hypot(best[0] - lx, best[1] - ly) > max_jump:
        return None  # ningún candidato plausible: dejar al tracker
    return best


def detect_color(hsv: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> tuple[float, float, float] | None:
    """Detecta por color (umbral HSV) el mayor contorno y su círculo envolvente."""
    mask = cv2.inRange(hsv, lo, hi)
    mask = cv2.erode(mask, None, iterations=2)
    mask = cv2.dilate(mask, None, iterations=2)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 20:
        return None
    (x, y), r = cv2.minEnclosingCircle(c)
    return float(x), float(y), float(r)


def make_tracker():
    """Crea un tracker CSRT compatible con distintas versiones de OpenCV."""
    if hasattr(cv2, "TrackerCSRT_create"):
        return cv2.TrackerCSRT_create()
    if hasattr(cv2, "legacy") and hasattr(cv2.legacy, "TrackerCSRT_create"):
        return cv2.legacy.TrackerCSRT_create()
    return None


# --------------------------------------------------------------------------- #
# Rastreo sobre el video
# --------------------------------------------------------------------------- #

def track(args) -> tuple[list[Detection], float, tuple[int, int]]:
    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise SystemExit(f"No se pudo abrir el video: {args.video}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 1:
        fps = args.fps
        print(f"[aviso] FPS no disponible en el video; usando --fps={fps}")
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    color_lo = np.array(args.hsv_lo, dtype=np.uint8) if args.method == "color" else None
    color_hi = np.array(args.hsv_hi, dtype=np.uint8) if args.method == "color" else None

    detections: list[Detection] = []
    tracker = None
    last_pos: tuple[float, float] | None = None
    max_jump = args.max_jump if args.max_jump else w * 0.2
    frame_idx = -1

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        t = frame_idx / fps

        if args.method == "color":
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            one = detect_color(hsv, color_lo, color_hi)
            candidates = [one] if one is not None else []
        else:  # hough (forma) — sirve para balines metálicos/grises
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            candidates = detect_hough(gray, args.min_radius, args.max_radius)

        det = pick_circle(candidates, last_pos, max_jump)

        if det is not None:
            last_pos = (det[0], det[1])
            x, y, r = det
            detections.append(Detection(frame_idx, t, x, y, r, True))
            # (Re)inicia el tracker para poder puentear oclusiones.
            tr = make_tracker()
            if tr is not None:
                tr.init(frame, (int(x - r), int(y - r), int(2 * r), int(2 * r)))
                tracker = tr
        elif tracker is not None:
            ok2, box = tracker.update(frame)
            if ok2:
                bx, by, bw, bh = box
                cx, cy = bx + bw / 2, by + bh / 2
                # El tracker también puede derivar: rechaza saltos imposibles.
                if last_pos is None or np.hypot(cx - last_pos[0], cy - last_pos[1]) <= max_jump:
                    last_pos = (cx, cy)
                    detections.append(Detection(frame_idx, t, cx, cy, (bw + bh) / 4, False))
                else:
                    tracker = None
                    detections.append(Detection(frame_idx, t, np.nan, np.nan, np.nan, False))
            else:
                tracker = None
                detections.append(Detection(frame_idx, t, np.nan, np.nan, np.nan, False))
        else:
            detections.append(Detection(frame_idx, t, np.nan, np.nan, np.nan, False))

    cap.release()
    real = sum(1 for d in detections if d.found)
    print(f"[info] {len(detections)} cuadros, {real} detecciones reales, {fps:.1f} FPS, {w}x{h}")
    return detections, fps, (w, h)


# --------------------------------------------------------------------------- #
# Física a partir de la trayectoria
# --------------------------------------------------------------------------- #

def analyze(detections: list[Detection], fps: float, args) -> dict:
    from scipy.signal import savgol_filter

    t = np.array([d.t for d in detections])
    x = np.array([d.x for d in detections])
    y = np.array([d.y for d in detections])
    r = np.array([d.r for d in detections])

    # Interpola huecos (NaN).
    def interp(a):
        idx = np.arange(len(a))
        good = ~np.isnan(a)
        if good.sum() < 2:
            raise SystemExit("Muy pocas detecciones para analizar. Revisa el video/umbrales.")
        return np.interp(idx, idx[good], a[good])

    x, y, r = interp(x), interp(y), interp(r)

    # Calibración px -> m.
    if args.scale:
        scale = args.scale
    elif args.ball_diameter_m:
        scale = args.ball_diameter_m / (2 * np.median(r))
    else:
        scale = 1.0  # sin calibrar: resultados en "px" (solo para prueba)
        print("[aviso] Sin calibración: distancias en píxeles, no en metros.")

    x_m = x * scale
    height_m = (y.max() - y) * scale  # invierte el eje (arriba = +) y pone el mínimo en 0

    # Suavizado.
    win = min(args.smooth_window, len(t) - (1 - len(t) % 2))
    if win >= 5 and win % 2 == 1:
        x_m = savgol_filter(x_m, win, 3)
        height_m = savgol_filter(height_m, win, 3)

    # Derivadas -> velocidad.
    vx = np.gradient(x_m, t)
    vy = np.gradient(height_m, t)
    speed = np.hypot(vx, vy)

    # Energías (por unidad de masa si no se da masa).
    m = args.mass
    ke = 0.5 * m * speed**2
    pe = m * args.gravity * height_m
    energy = ke + pe

    return dict(
        t=t, x_m=x_m, height_m=height_m, vx=vx, vy=vy, speed=speed,
        ke=ke, pe=pe, energy=energy, x_px=x, y_px=y, r_px=r, scale=scale,
    )


# --------------------------------------------------------------------------- #
# Salidas
# --------------------------------------------------------------------------- #

def write_csv(path: str, res: dict) -> None:
    with open(path, "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["t_s", "x_m", "height_m", "vx", "vy", "speed_ms", "KE_J", "PE_J", "E_J", "x_px", "y_px", "r_px"])
        n = len(res["t"])
        for i in range(n):
            wr.writerow([f"{res[k][i]:.6f}" for k in
                         ["t", "x_m", "height_m", "vx", "vy", "speed", "ke", "pe", "energy", "x_px", "y_px", "r_px"]])


def write_plots(path: str, res: dict, calibrated: bool) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    unit = "m" if calibrated else "px"
    fig, ax = plt.subplots(1, 3, figsize=(15, 4))

    ax[0].plot(res["x_m"], res["height_m"], "-", color="#4da3ff")
    ax[0].set_title("Trayectoria")
    ax[0].set_xlabel(f"x ({unit})")
    ax[0].set_ylabel(f"altura ({unit})")
    ax[0].axis("equal")

    ax[1].plot(res["t"], res["speed"], color="#111")
    ax[1].set_title("Rapidez vs tiempo")
    ax[1].set_xlabel("t (s)")
    ax[1].set_ylabel(f"rapidez ({unit}/s)")

    ax[2].plot(res["t"], res["ke"], label="Cinética", color="#ff8c42")
    ax[2].plot(res["t"], res["pe"], label="Potencial", color="#4da3ff")
    ax[2].plot(res["t"], res["energy"], "--", label="Total", color="#5ad19b")
    ax[2].set_title("Energía vs tiempo")
    ax[2].set_xlabel("t (s)")
    ax[2].set_ylabel("energía (J)")
    ax[2].legend()

    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


_VIEWER_TEMPLATE = r"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Análisis del balín · visor</title>
<style>
  :root { color-scheme: dark; --bg:#0e1116; --panel:#171b22; --border:#2a313c; --text:#e6e9ef; --muted:#9aa4b2;
          --ke:#ff8c42; --pe:#4da3ff; --tot:#5ad19b; --spd:#e6e9ef; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:system-ui,Segoe UI,Roboto,sans-serif; }
  header { padding:14px 20px; border-bottom:1px solid var(--border); }
  header h1 { margin:0; font-size:18px; }
  header p { margin:4px 0 0; color:var(--muted); font-size:13px; }
  .wrap { display:grid; grid-template-columns:1.4fr 300px; gap:16px; padding:16px; }
  @media (max-width:820px){ .wrap{ grid-template-columns:1fr; } }
  .videobox { position:relative; background:#000; border-radius:10px; overflow:hidden; }
  .videobox video { width:100%; display:block; }
  .videobox canvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
  #bbox { position:absolute; border:2px solid #00ff88; border-radius:4px; box-shadow:0 0 0 1px rgba(0,0,0,.5);
          pointer-events:auto; cursor:help; transition:none; }
  #bbox .lbl { position:absolute; left:-1px; top:-20px; background:#00ff88; color:#04120a; font-size:11px;
               font-weight:700; padding:1px 6px; border-radius:4px; white-space:nowrap; font-variant-numeric:tabular-nums; }
  #tip { position:absolute; z-index:5; display:none; background:#0b0e13; border:1px solid #00ff88; border-radius:8px;
         padding:8px 10px; font-size:12px; line-height:1.5; pointer-events:none; box-shadow:0 6px 20px rgba(0,0,0,.5); }
  #tip b { font-variant-numeric:tabular-nums; }
  .controls { display:flex; align-items:center; gap:10px; margin-top:8px; }
  .controls select { background:var(--panel); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:6px 8px; }
  .controls input[type=range]{ flex:1; accent-color:var(--pe); }
  button { background:var(--panel); color:var(--text); border:1px solid var(--border); border-radius:8px; padding:8px 14px; cursor:pointer; font-size:14px; }
  .readouts { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cell { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:10px; }
  .cell .k { font-size:11px; color:var(--muted); }
  .cell .v { font-size:20px; font-weight:700; font-variant-numeric:tabular-nums; }
  .cell .u { font-size:12px; color:var(--muted); margin-left:3px; }
  .chart { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:8px 8px 4px; margin:0 16px 16px; }
  .chart h2 { margin:2px 6px 6px; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .chart canvas { width:100%; height:150px; display:block; cursor:crosshair; }
  .legend { display:flex; gap:14px; font-size:12px; color:var(--muted); margin:6px; flex-wrap:wrap; }
  .legend span { display:inline-flex; align-items:center; gap:5px; }
  .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
  .hint { color:var(--muted); font-size:12px; margin:6px; }
</style>
</head>
<body>
<header>
  <h1>🎥 Análisis del balín — visor interactivo</h1>
  <p>Reproduce el video o arrastra sobre las gráficas: verás el balín y su energía en cada instante.</p>
</header>

<div class="wrap">
  <div>
    <div class="videobox">
      <video id="vid" src="__VIDEO__" preload="auto" playsinline></video>
      <canvas id="ovl"></canvas>
      <div id="bbox"><span class="lbl" id="bboxLabel">balín</span></div>
      <div id="tip"></div>
    </div>
    <div class="controls">
      <button id="play">▶︎</button>
      <input id="scrub" type="range" min="0" max="1000" value="0" />
      <label style="color:var(--muted); font-size:13px;">Cámara lenta
        <select id="rate">
          <option value="0.15">0.15×</option>
          <option value="0.25">0.25×</option>
          <option value="0.5" selected>0.5×</option>
          <option value="1">1×</option>
        </select>
      </label>
      <span id="tlabel" style="font-variant-numeric:tabular-nums; color:var(--muted); min-width:96px; text-align:right;">0.00 / 0.00 s</span>
    </div>
  </div>

  <div class="readouts">
    <div class="cell"><div class="k">Tiempo</div><div class="v"><span id="r_t">0.00</span><span class="u">s</span></div></div>
    <div class="cell"><div class="k">Rapidez</div><div class="v"><span id="r_v">0.00</span><span class="u">__UNIT__/s</span></div></div>
    <div class="cell"><div class="k">Altura</div><div class="v"><span id="r_h">0.00</span><span class="u">__UNIT__</span></div></div>
    <div class="cell"><div class="k">E. total</div><div class="v"><span id="r_e">0.00</span><span class="u">J</span></div></div>
    <div class="cell"><div class="k" style="color:var(--ke)">E. cinética</div><div class="v"><span id="r_ke">0.00</span><span class="u">J</span></div></div>
    <div class="cell"><div class="k" style="color:var(--pe)">E. potencial</div><div class="v"><span id="r_pe">0.00</span><span class="u">J</span></div></div>
  </div>
</div>

<div class="chart">
  <h2>Energía vs tiempo</h2>
  <canvas id="cE"></canvas>
  <div class="legend">
    <span><i class="dot" style="background:var(--ke)"></i>Cinética</span>
    <span><i class="dot" style="background:var(--pe)"></i>Potencial</span>
    <span><i class="dot" style="background:var(--tot)"></i>Total</span>
    <span class="hint">Clic o arrastra para saltar a ese momento.</span>
  </div>
</div>

<div class="chart">
  <h2>Rapidez vs tiempo</h2>
  <canvas id="cV"></canvas>
</div>

<script>
const D = __DATA__;
const N = D.t.length;
const dur = D.t[N-1] || (N/D.fps);
const vid = document.getElementById('vid');
const ovl = document.getElementById('ovl');
const octx = ovl.getContext('2d');
const $ = (id)=>document.getElementById(id);

function idxAt(tt){ let i = Math.round(tt * D.fps); return Math.max(0, Math.min(N-1, i)); }

// --- Gráficas (canvas 2D, sin librerías) ---
function setupCanvas(c){
  const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio||1;
  c.width = r.width*dpr; c.height = r.height*dpr; const g = c.getContext('2d'); g.scale(dpr,dpr);
  return { g, w:r.width, h:r.height };
}
function drawSeries(c, series, cursorFrac){
  const { g, w, h } = setupCanvas(c);
  g.clearRect(0,0,w,h);
  let max = 1e-9; for (const s of series) for (const v of s.data) if (v>max) max=v;
  // grid
  g.strokeStyle = '#232a34'; g.lineWidth=1;
  for (let k=0;k<=4;k++){ const y=h*k/4; g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
  // lines
  for (const s of series){
    g.strokeStyle=s.color; g.lineWidth=s.dash?1.5:2; if(s.dash)g.setLineDash([5,3]); else g.setLineDash([]);
    g.beginPath();
    for (let i=0;i<N;i++){ const x=w*i/(N-1); const y=h-(s.data[i]/max)*h*0.94-3; if(i===0)g.moveTo(x,y); else g.lineTo(x,y); }
    g.stroke();
  }
  g.setLineDash([]);
  // cursor
  const cx = w*cursorFrac; g.strokeStyle='#ffffff'; g.lineWidth=1; g.setLineDash([3,3]);
  g.beginPath(); g.moveTo(cx,0); g.lineTo(cx,h); g.stroke(); g.setLineDash([]);
}
function redrawCharts(frac){
  drawSeries($('cE'), [
    {data:D.ke, color:getCSS('--ke')},
    {data:D.pe, color:getCSS('--pe')},
    {data:D.energy, color:getCSS('--tot'), dash:true},
  ], frac);
  drawSeries($('cV'), [{data:D.speed, color:getCSS('--spd')}], frac);
}
function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

// --- Overlay del balín: traza + bounding box que lo sigue ---
const bbox = $('bbox'), bboxLabel = $('bboxLabel'), tip = $('tip');
const videobox = document.querySelector('.videobox');
let curIdx = 0, lastBox = {x:0,y:0,w:0};

function tipHTML(i){
  return `<b>t = ${D.t[i].toFixed(2)} s</b><br>`
    + `rapidez: <b>${D.speed[i].toFixed(2)} ${D.unit}/s</b><br>`
    + `altura: <b>${D.height[i].toFixed(2)} ${D.unit}</b><br>`
    + `<span style="color:var(--ke)">KE: <b>${D.ke[i].toFixed(2)} J</b></span><br>`
    + `<span style="color:var(--pe)">PE: <b>${D.pe[i].toFixed(2)} J</b></span>`;
}

function drawBall(i){
  curIdx = i;
  const r = vid.getBoundingClientRect();
  ovl.width = r.width; ovl.height = r.height;
  octx.clearRect(0,0,ovl.width,ovl.height);
  const sx = r.width/D.w, sy = r.height/D.h;
  const x = D.xpx[i]*sx, y = D.ypx[i]*sy;
  if (!isFinite(x)) { bbox.style.display='none'; return; }

  // Traza de los últimos cuadros.
  octx.strokeStyle='rgba(0,255,200,.85)'; octx.lineWidth=2; octx.beginPath();
  let started=false;
  for (let k=Math.max(0,i-45);k<=i;k++){
    const px=D.xpx[k]*sx, py=D.ypx[k]*sy;
    if(!isFinite(px)){started=false;continue;}
    if(!started){octx.moveTo(px,py);started=true;} else octx.lineTo(px,py);
  }
  octx.stroke();

  // Bounding box siguiendo al balín (tipo tracker real).
  const rad = isFinite(D.rpx[i]) ? D.rpx[i] : 12;
  const bw = Math.max(28, rad*2.6*sx), bh = Math.max(28, rad*2.6*sy);
  bbox.style.display='block';
  bbox.style.left=(x-bw/2)+'px'; bbox.style.top=(y-bh/2)+'px';
  bbox.style.width=bw+'px'; bbox.style.height=bh+'px';
  bboxLabel.textContent = 'balín · v=' + D.speed[i].toFixed(1) + ' ' + D.unit + '/s';
  lastBox = {x:x-bw/2, y:y-bh/2, w:bw};

  if (tip.style.display==='block') tip.innerHTML = tipHTML(i); // refresca si está visible
}

// Tooltip al pasar el cursor por el bounding box.
bbox.addEventListener('mouseenter', ()=>{ tip.innerHTML=tipHTML(curIdx); tip.style.display='block'; positionTip(); });
bbox.addEventListener('mousemove', positionTip);
bbox.addEventListener('mouseleave', ()=>{ tip.style.display='none'; });
function positionTip(){
  let tx = lastBox.x + lastBox.w + 10, ty = lastBox.y;
  if (tx + 160 > videobox.clientWidth) tx = lastBox.x - 160;  // no salirse por la derecha
  tip.style.left = Math.max(4,tx)+'px'; tip.style.top = Math.max(4,ty)+'px';
}

// --- Lecturas ---
function update(tt){
  const i = idxAt(tt);
  const frac = dur>0 ? Math.min(1, tt/dur) : 0;
  $('r_t').textContent = tt.toFixed(2);
  $('r_v').textContent = D.speed[i].toFixed(2);
  $('r_h').textContent = D.height[i].toFixed(2);
  $('r_e').textContent = D.energy[i].toFixed(3);
  $('r_ke').textContent = D.ke[i].toFixed(3);
  $('r_pe').textContent = D.pe[i].toFixed(3);
  $('tlabel').textContent = tt.toFixed(2)+' / '+dur.toFixed(2)+' s';
  $('scrub').value = String(Math.round(frac*1000));
  redrawCharts(frac);
  drawBall(i);
}

// --- Interacción ---
$('play').onclick = ()=>{ if(vid.paused){vid.play();$('play').textContent='⏸';} else {vid.pause();$('play').textContent='▶︎';} };
$('scrub').oninput = (e)=>{ const f=(+e.target.value)/1000; vid.currentTime=f*dur; };
function seekFromChart(c, ev){ const r=c.getBoundingClientRect(); const f=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)); vid.currentTime=f*dur; }
for (const id of ['cE','cV']){
  const c=$(id); let down=false;
  c.addEventListener('pointerdown',e=>{down=true;seekFromChart(c,e);});
  c.addEventListener('pointermove',e=>{if(down)seekFromChart(c,e);});
  window.addEventListener('pointerup',()=>down=false);
}
$('rate').onchange = (e)=>{ vid.playbackRate = parseFloat(e.target.value); };
vid.addEventListener('loadedmetadata', ()=>{ vid.playbackRate = parseFloat($('rate').value); update(0); });
vid.playbackRate = 0.5;
(function loop(){ update(vid.currentTime||0); requestAnimationFrame(loop); })();
window.addEventListener('resize', ()=>update(vid.currentTime||0));
</script>
</body>
</html>
"""


def write_viewer(path: str, video_rel: str, res: dict, size, fps: float, calibrated: bool) -> None:
    """Genera un visor HTML interactivo: video + gráficas sincronizadas + scrubber.

    Al mover el cursor por la línea de tiempo (o reproducir el video), se resalta
    el balín y se muestran rapidez y energías de ese instante exacto.
    """
    import json

    def arr(key, mul=1.0):
        return [round(float(v) * mul, 4) for v in res[key]]

    unit = "m" if calibrated else "px"
    data = {
        "fps": fps,
        "w": size[0],
        "h": size[1],
        "unit": unit,
        "t": arr("t"),
        "xpx": arr("x_px"),
        "ypx": arr("y_px"),
        "rpx": arr("r_px"),
        "height": arr("height_m"),
        "speed": arr("speed"),
        "ke": arr("ke"),
        "pe": arr("pe"),
        "energy": arr("energy"),
    }
    payload = json.dumps(data)

    html = _VIEWER_TEMPLATE.replace("__VIDEO__", video_rel).replace("__DATA__", payload).replace("__UNIT__", unit)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)


def write_overlay(path: str, video: str, detections: list[Detection], res: dict, size) -> None:
    cap = cv2.VideoCapture(video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(path, fourcc, fps, size)
    trail: list[tuple[int, int]] = []
    i = -1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        i += 1
        if i >= len(detections):
            break
        x, y, r = res["x_px"][i], res["y_px"][i], res["r_px"][i]
        if not np.isnan(x):
            cx, cy = int(x), int(y)
            trail.append((cx, cy))
            trail[:] = trail[-40:]
            cv2.circle(frame, (cx, cy), int(max(r, 4)), (0, 255, 0), 2)
            cv2.circle(frame, (cx, cy), 3, (0, 0, 255), -1)
            for j in range(1, len(trail)):
                cv2.line(frame, trail[j - 1], trail[j], (0, 255, 255), 2)
            cv2.putText(frame, f"v={res['speed'][i]:.2f}", (cx + 10, cy - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        out.write(frame)
    cap.release()
    out.release()


# --------------------------------------------------------------------------- #

def main():
    p = argparse.ArgumentParser(description="Rastrea un balín en video y calcula su física.")
    p.add_argument("--video", required=True, help="Ruta del video de entrada.")
    p.add_argument("--out-dir", default="out", help="Carpeta de salidas.")
    p.add_argument("--method", choices=["hough", "color"], default="hough",
                   help="Detección por forma (hough, para balín metálico) o color (HSV).")
    p.add_argument("--min-radius", type=int, default=4)
    p.add_argument("--max-radius", type=int, default=80)
    p.add_argument("--max-jump", type=float, default=0,
                   help="Salto máximo plausible del balín entre cuadros (px). 0 = 20%% del ancho.")
    p.add_argument("--hsv-lo", type=int, nargs=3, default=[35, 80, 80], help="HSV inferior (método color).")
    p.add_argument("--hsv-hi", type=int, nargs=3, default=[85, 255, 255], help="HSV superior (método color).")
    # Calibración / física
    p.add_argument("--scale", type=float, default=None, help="Metros por píxel (si ya lo conoces).")
    p.add_argument("--ball-diameter-m", type=float, default=None, help="Diámetro real del balín (m) para autocalibrar.")
    p.add_argument("--mass", type=float, default=1.0, help="Masa del balín (kg) para la energía.")
    p.add_argument("--gravity", type=float, default=9.81)
    p.add_argument("--fps", type=float, default=30.0, help="FPS a usar si el video no lo reporta.")
    p.add_argument("--smooth-window", type=int, default=11, help="Ventana del filtro Savitzky-Golay (impar).")
    p.add_argument("--no-overlay", action="store_true", help="No generar el video con overlay.")
    args = p.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    detections, fps, size = track(args)
    res = analyze(detections, fps, args)

    calibrated = bool(args.scale or args.ball_diameter_m)
    stem = os.path.splitext(os.path.basename(args.video))[0]
    csv_path = os.path.join(args.out_dir, f"{stem}_trayectoria.csv")
    plot_path = os.path.join(args.out_dir, f"{stem}_graficas.png")
    viewer_path = os.path.join(args.out_dir, f"{stem}_visor.html")
    write_csv(csv_path, res)
    write_plots(plot_path, res, calibrated)

    # Visor interactivo: referencia al video con ruta relativa desde out/.
    video_rel = os.path.relpath(os.path.abspath(args.video), os.path.abspath(args.out_dir)).replace("\\", "/")
    write_viewer(viewer_path, video_rel, res, size, fps, calibrated)
    print(f"[ok] visor   -> {viewer_path}")

    if not args.no_overlay:
        overlay_path = os.path.join(args.out_dir, f"{stem}_overlay.mp4")
        write_overlay(overlay_path, args.video, detections, res, size)
        print(f"[ok] overlay -> {overlay_path}")

    unit = "m/s" if calibrated else "px/s"
    print(f"[ok] CSV     -> {csv_path}")
    print(f"[ok] gráficas -> {plot_path}")
    print(f"[resumen] rapidez máx = {np.nanmax(res['speed']):.3f} {unit} | "
          f"escala = {res['scale']:.6g} m/px | cuadros = {len(res['t'])}")


if __name__ == "__main__":
    main()
