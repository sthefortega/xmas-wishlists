// Nieve que cae desde el puntero. Con ratón, un rastro al moverlo; en pantallas
// táctiles, un puñado de copos en cada toque. No se activa si la persona pidió
// reducir el movimiento.

export function initSnow() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'snow';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');

  let w = 0;
  let h = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const rand = (a, b) => a + Math.random() * (b - a);
  const flakes = [];
  let running = false;
  let last = 0;
  let spawnX = -999;
  let spawnY = -999;
  let prevX = 0;

  function spawn(x, y, count, spreadX, spreadY, speedX, drift) {
    for (let i = 0; i < count; i++) {
      flakes.push({
        x: x + rand(-spreadX, spreadX),
        y: y + rand(-spreadY, spreadY),
        r: rand(1.6, 3.8),
        vx: rand(-speedX, speedX) + drift,
        vy: rand(0.3, 1),
        sway: rand(0, 6.28),
        life: 1,
      });
    }
    if (flakes.length > 240) flakes.splice(0, flakes.length - 240);
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const moved = Math.hypot(e.clientX - spawnX, e.clientY - spawnY);
      if (moved < 14) return;
      const drift = (e.clientX - prevX) * 0.015;
      prevX = e.clientX;
      spawnX = e.clientX;
      spawnY = e.clientY;
      spawn(e.clientX, e.clientY, moved > 60 ? 3 : 2, 8, 8, 0.25, drift);
    },
    { passive: true }
  );

  // Toque en pantalla táctil: un puñado de copos que se abre y cae.
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse') return;
      spawn(e.clientX, e.clientY, 14, 10, 8, 0.9, 0);
    },
    { passive: true }
  );

  function tick(now) {
    const dt = Math.min((now - last) / 16.7, 3);
    last = now;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(30, 50, 40, 0.5)';
    ctx.shadowBlur = 3;
    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i];
      f.sway += 0.05 * dt;
      f.x += (f.vx + Math.sin(f.sway) * 0.4) * dt;
      f.y += f.vy * dt;
      f.vy += 0.012 * dt;
      f.life -= 0.008 * dt;
      if (f.life <= 0 || f.y > h + 10) {
        flakes.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, f.life * 1.4);
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (flakes.length) {
      requestAnimationFrame(tick);
    } else {
      running = false;
      ctx.clearRect(0, 0, w, h);
    }
  }
}
