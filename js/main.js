(function () {
  const C = window.CONTENT;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');

  // ── Дата: всё производное считается из CONTENT.date ──
  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS_GEN_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const DOW = {
    kg: ['дүйшөмбү', 'шейшемби', 'шаршемби', 'бейшемби', 'жума', 'ишемби', 'жекшемби'],
    ru: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
  };
  const DOW_SHORT = {
    kg: ['дш', 'шш', 'шр', 'бш', 'жм', 'иш', 'жк'],
    ru: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
  };
  const [Y, M, D] = C.date.slice(0, 10).split('-').map(Number);
  const TIME = C.date.slice(11, 16);
  const mondayFirst = (date) => (date.getUTCDay() + 6) % 7;
  const dow = mondayFirst(new Date(Date.UTC(Y, M - 1, D)));

  function derived(lang) {
    const t = C[lang];
    return {
      heroDate: `${pad(D)} · ${pad(M)} · ${Y}`,
      dayNum: String(D),
      month: MONTHS[M - 1],
      dateLine: lang === 'kg'
        ? `${MONTHS[M - 1].toLowerCase()} ${Y} · ${DOW.kg[dow]}`
        : `${MONTHS_GEN_RU[M - 1]} ${Y} · ${DOW.ru[dow]}`,
      timeLine: t.timeLine.replace('{time}', TIME),
      unit0: t.units[0], unit1: t.units[1], unit2: t.units[2], unit3: t.units[3],
    };
  }

  // ── Язык ──
  function initialLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'kg' || q === 'ru') return q;
    try {
      const saved = localStorage.getItem('lang');
      if (saved === 'kg' || saved === 'ru') return saved;
    } catch (e) { /* хранилище недоступно в приватном режиме — остаётся язык по умолчанию */ }
    return 'kg';
  }

  function setLang(lang) {
    const t = Object.assign({}, C[lang], derived(lang));
    root.lang = lang === 'kg' ? 'ky' : 'ru';
    $$('[data-t]').forEach((el) => {
      const value = t[el.dataset.t];
      if (value != null) el.textContent = value;
    });
    $$('.cal__dow').forEach((el, i) => { el.textContent = DOW_SHORT[lang][i]; });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.title = `${t.groom} & ${t.bride} — ${t.title}`;
    try { localStorage.setItem('lang', lang); } catch (e) { /* см. initialLang */ }
    measure();
  }

  // ── Росчерк не переносится: имя или заголовок, который не влез в строку, уменьшается ──
  const names = $('#names');
  function fitScript() {
    names.style.fontSize = '';
    const base = parseFloat(getComputedStyle(names).fontSize);
    const room = names.clientWidth * .92;
    const widest = Math.max(...$$('.names__a, .names__b', names).map((s) => s.offsetWidth));
    if (widest > room) names.style.fontSize = `${base * room / widest}px`;
    $$('.title, .bye, .env__to').forEach((el) => {
      el.style.fontSize = '';
      if (el.scrollWidth <= el.clientWidth) return;
      el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * el.clientWidth / el.scrollWidth}px`;
    });
  }

  // ── Заглавное фото: «cover» вручную, чтобы огни стояли на факелах в кадре ──
  const hero = $('.hero');
  const plate = $('#plate');
  const plateImg = plate.querySelector('img');
  const IW = +plateImg.getAttribute('width'), IH = +plateImg.getAttribute('height');
  function layoutPlate() {
    const W = hero.clientWidth, H = hero.clientHeight;
    const s = Math.max(W / IW, H / IH);
    const w = IW * s, h = IH * s;
    Object.assign(plate.style, {
      width: `${w}px`, height: `${h}px`,
      left: `${(W - w) / 2}px`, top: `${H - h}px`,
      right: 'auto', bottom: 'auto',
    });
  }

  // ── Небо: каждая секция задаёт «время вечера» data-sky 0…1, между секциями — плавный переход ──
  const SKY = [
    { t: 0, top: [111, 124, 151], mid: [201, 162, 154], low: [240, 180, 140] },
    { t: .35, top: [85, 96, 122], mid: [196, 128, 128], low: [229, 154, 140] },
    { t: .62, top: [58, 30, 52], mid: [98, 24, 36], low: [150, 52, 50] },
    { t: .8, top: [34, 10, 18], mid: [56, 12, 22], low: [96, 18, 30] },
    { t: .92, top: [8, 6, 6], mid: [12, 8, 8], low: [18, 9, 8] },
    { t: 1, top: [20, 4, 9], mid: [42, 7, 13], low: [61, 11, 20] },
  ];
  const sections = $$('[data-sky]');
  let marks = [];
  function measure() {
    fitScript();
    layoutPlate();
    marks = sections.map((s) => ({ y: s.offsetTop + s.offsetHeight / 2, v: Number(s.dataset.sky) }));
    paint();
  }
  function eveningAt(y) {
    if (y <= marks[0].y) return marks[0].v;
    for (let i = 1; i < marks.length; i++) {
      if (y <= marks[i].y) {
        const a = marks[i - 1], b = marks[i];
        return a.v + (b.v - a.v) * (y - a.y) / (b.y - a.y);
      }
    }
    return marks[marks.length - 1].v;
  }
  function paint() {
    const t = eveningAt(scrollY + innerHeight / 2);
    let i = 1;
    while (i < SKY.length - 1 && SKY[i].t < t) i++;
    const a = SKY[i - 1], b = SKY[i];
    const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    const mix = (key) => `rgb(${a[key].map((v, j) => Math.round(v + (b[key][j] - v) * k)).join(',')})`;
    root.style.setProperty('--sky-top', mix('top'));
    root.style.setProperty('--sky-mid', mix('mid'));
    root.style.setProperty('--sky-low', mix('low'));
    root.style.setProperty('--sun', Math.max(0, 1 - t * 1.5).toFixed(3));
    root.style.setProperty('--stars', Math.max(0, (t - .55) / .45).toFixed(3));
    window.Fire.night = t;
  }
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);

  const stars = $('#stars');
  for (let i = 0; i < 46; i++) {
    const s = document.createElement('i');
    const size = 1 + Math.random() * 1.6;
    Object.assign(s.style, {
      left: `${Math.random() * 100}%`, top: `${Math.random() * 72}%`,
      width: `${size}px`, height: `${size}px`,
      animationDelay: `${-Math.random() * 4}s`,
    });
    stars.appendChild(s);
  }

  // ── Календарь месяца, день тоя обведён сердцем ──
  const HEART = '<svg class="cal__heart" viewBox="0 0 100 90" aria-hidden="true"><path pathLength="1" d="M50 84C20 62 4 44 4 27 4 13 15 4 27 4c10 0 19 6 23 16C54 10 63 4 73 4c12 0 23 9 23 23 0 17-16 35-46 57Z"/></svg>';
  const cal = $('#cal');
  const firstDow = mondayFirst(new Date(Date.UTC(Y, M - 1, 1)));
  const daysInMonth = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  let cells = '';
  for (let i = 0; i < 7; i++) cells += '<span class="cal__dow"></span>';
  for (let i = 0; i < firstDow; i++) cells += '<span></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    cells += d === D
      ? `<span class="cal__day cal__day--the">${HEART}<b>${d}</b></span>`
      : `<span class="cal__day">${d}</span>`;
  }
  cal.innerHTML = cells;

  // ── Обратный отсчёт ──
  const target = new Date(C.date).getTime();
  const slots = [$('#tD'), $('#tH'), $('#tM'), $('#tS')];
  function tick() {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const values = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    values.forEach((v, i) => {
      const text = pad(v);
      if (slots[i].dataset.v === text) return;
      slots[i].dataset.v = text;
      slots[i].innerHTML = text.split('').map((ch) => `<i>${ch}</i>`).join('');
    });
  }
  tick();
  setInterval(tick, 1000);

  // ── Карта, печать ──
  $('#map').href = C.mapUrl;
  if (C.monogram) $('#mono').textContent = C.monogram;

  // ── Музыка: стартует по тапу на печать — без жеста браузер звук не включит ──
  const musicBtn = $('#music');
  let audio = null;
  function setMusic(on) {
    if (!audio) return;
    musicBtn.setAttribute('aria-pressed', String(on));
    if (!on) return audio.pause();
    audio.play().catch(() => musicBtn.setAttribute('aria-pressed', 'false')); // браузер запретил автозвук
  }
  if (C.music) {
    audio = new Audio(C.music);
    audio.loop = true;
    audio.volume = .55;
    musicBtn.hidden = false;
    musicBtn.addEventListener('click', () => setMusic(audio.paused));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) audio.pause();
      else if (musicBtn.getAttribute('aria-pressed') === 'true') setMusic(true);
    });
  }

  // ── Конверт ──
  const env = $('#env');
  $('#envOpen').addEventListener('click', () => {
    env.classList.add('is-opening');
    setMusic(true);
    setTimeout(() => {
      root.classList.remove('is-sealed');
      root.classList.add('is-open');
      env.classList.add('is-open');
    }, reduce ? 0 : 1750);
  }, { once: true });

  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

  // ── Появление блоков при скролле ──
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: .18 });
  $$('[data-reveal]').forEach((el) => io.observe(el));

  setLang(initialLang());
  window.Fire.init();
  document.fonts.ready.then(measure);
})();
