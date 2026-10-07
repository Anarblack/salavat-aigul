// Огонь на canvas: пламя факелов в кадре и искры через всю страницу.
// Один requestAnimationFrame на всё; то, что вне экрана, не считается и не рисуется.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function sprite(stops) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(([at, color]) => grad.addColorStop(at, color));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  const HOT = sprite([[0, 'rgba(255,246,214,1)'], [.35, 'rgba(255,196,96,.75)'], [1, 'rgba(255,140,40,0)']]);
  const MID = sprite([[0, 'rgba(255,170,70,.9)'], [.5, 'rgba(240,118,42,.45)'], [1, 'rgba(220,70,20,0)']]);
  const COOL = sprite([[0, 'rgba(226,84,30,.55)'], [1, 'rgba(120,20,10,0)']]);
  const DOT = sprite([[0, 'rgba(255,220,160,1)'], [.4, 'rgba(255,150,60,.6)'], [1, 'rgba(240,118,42,0)']]);

  class Layer {
    constructor(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.parts = [];
      this.visible = false;
      this.resize();
    }
    resize() {
      this.w = this.canvas.offsetWidth;
      this.h = this.canvas.offsetHeight;
      this.canvas.width = Math.round(this.w * DPR);
      this.canvas.height = Math.round(this.h * DPR);
      this.g.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    age(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.age += dt;
        if (p.age >= p.life) this.parts.splice(i, 1);
      }
    }
  }

  class Flame extends Layer {
    constructor(canvas) {
      super(canvas);
      this.lean = parseFloat(canvas.dataset.lean || 0);
      this.t = rnd(0, 20);
      this.acc = 0;
    }
    step(dt) {
      const { w, h } = this;
      this.t += dt;
      const gust = Math.sin(this.t * 1.9) * .5 + Math.sin(this.t * 3.7 + 1.1) * .3 + this.lean;
      this.acc += dt * 70;
      while (this.acc >= 1) {
        this.acc -= 1;
        if (Math.random() < .035) {
          this.parts.push({ ember: true, x: w / 2 + rnd(-.06, .06) * w, y: h * .8, vx: rnd(-.3, .3) * w, vy: -rnd(.7, 1.1) * h, r: rnd(.012, .02) * w, life: rnd(.9, 1.5), age: 0 });
        } else {
          this.parts.push({ x: w / 2 + rnd(-.06, .06) * w, y: h * .93, vx: rnd(-.05, .05) * w, vy: -rnd(.6, 1) * h, r: rnd(.1, .15) * w, life: rnd(.5, .85), age: 0 });
        }
      }
      this.age(dt);
      for (const p of this.parts) {
        const f = p.age / p.life;
        p.vx += gust * w * (p.ember ? 1.2 : 1.6) * f * dt;
        p.vy *= 1 - .6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    draw() {
      const { g, w, h } = this;
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (const p of this.parts) {
        const f = p.age / p.life;
        if (p.ember) {
          g.globalAlpha = (1 - f) * .9;
          g.drawImage(DOT, p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
          continue;
        }
        const r = p.r * (1 - .8 * f);
        g.globalAlpha = Math.min(1, f / .1) * (1 - f) * .5;
        g.drawImage(f < .25 ? HOT : f < .6 ? MID : COOL, p.x - r, p.y - r * 1.6, r * 2, r * 3.2);
      }
      g.globalAlpha = 1;
    }
  }

  // Искры поднимаются снизу экрана; чем темнее небо (night 0…1), тем их больше.
  class Sparks extends Layer {
    step(dt, night) {
      const target = Math.round(7 + 34 * night);
      if (this.parts.length < target && Math.random() < dt * 7) {
        this.parts.push({ x: rnd(0, this.w), y: this.h + 8, vy: -rnd(18, 48), ph: rnd(0, 6.28), sway: rnd(8, 26), r: rnd(1.2, 2.8), life: rnd(6, 11), age: 0 });
      }
      this.age(dt);
      for (const p of this.parts) {
        p.y += p.vy * dt;
        p.x += Math.sin(p.ph + p.age * 1.3) * p.sway * dt;
      }
    }
    draw() {
      const { g, w, h } = this;
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (const p of this.parts) {
        const f = p.age / p.life;
        g.globalAlpha = Math.sin(Math.PI * f) * (.6 + .4 * Math.sin(p.ph + p.age * 7));
        g.drawImage(DOT, p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
      }
      g.globalAlpha = 1;
    }
  }

  const Fire = {
    night: 0,
    init() {
      const layers = [];
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { e.target.__layer.visible = e.isIntersecting; });
      });
      const ro = new ResizeObserver((entries) => {
        entries.forEach((e) => {
          const layer = e.target.__layer;
          layer.resize();
          if (reduce) still(layer);
        });
      });
      const add = (canvas, Kind, observed) => {
        const layer = new Kind(canvas);
        canvas.__layer = layer;
        layers.push(layer);
        ro.observe(canvas);
        if (observed) io.observe(canvas); else layer.visible = true;
      };
      document.querySelectorAll('[data-flame]').forEach((c) => add(c, Flame, true));

      // Без анимации: пламя — один застывший кадр; искр и бликов нет.
      function still(layer) {
        layer.parts = [];
        for (let i = 0; i < 50; i++) layer.step(1 / 60, 0);
        layer.draw();
      }
      if (reduce) {
        layers.forEach(still);
        return;
      }

      const sparks = document.getElementById('sparks');
      if (sparks) add(sparks, Sparks, false);

      let last = performance.now();
      const frame = (now) => {
        const dt = Math.min(.05, (now - last) / 1000);
        last = now;
        if (!document.hidden) {
          for (const layer of layers) {
            if (!layer.visible) continue;
            layer.step(dt, Fire.night);
            layer.draw();
          }
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
  };

  window.Fire = Fire;
})();
