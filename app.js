/* =====================================================================
   ChargeRoute — app.js  (the interface)
   ---------------------------------------------------------------------
   This file only handles the page: reading the form, showing errors,
   switching tabs and drawing the animated route. All of the actual
   problem-solving lives in algorithms.js (window.ChargeAlgos).
   ===================================================================== */
(function () {
  'use strict';

  const A = window.ChargeAlgos;
  const MAX = A.LIMITS.MAX_STATIONS;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------- small helpers ----------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const km = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' km';
  const fmtTime = (ms) => (ms < 0.01 ? '<0.01 ms' : (ms < 10 ? ms.toFixed(2) : ms.toFixed(1)) + ' ms');

  /* ------------------- the four approaches: text + colours ------------------- */
  const APPROACHES = [
    {
      id: 'brute', name: 'Brute Force', color: 'var(--c-brute)',
      tagline: 'Try every possible combination of stops and keep the cheapest valid one.',
      time: 'O(2ⁿ · n)', timeWhy: 'Each station is either used or skipped, giving 2ⁿ subsets. Checking one subset means a pass over n stations.',
      space: 'O(n)', spaceWhy: 'Only the current subset and the best one found so far are stored.',
      steps: [
        '<b>Sort</b> the stations by distance from the start.',
        'Give every station an <b>ON / OFF switch</b>: ON = we stop there, OFF = we skip it. With n stations there are <b>2ⁿ</b> different switch patterns (subsets).',
        'For <b>each subset</b>, drive through it in order. If any gap (start → stop, stop → stop, last stop → destination) is longer than the battery range, the subset is <b>invalid</b>.',
        'For valid subsets, <b>add up</b> the charging costs of the chosen stations.',
        'Keep the <b>cheapest valid subset</b> (if two cost the same, the one with fewer stops). After all 2ⁿ subsets are checked, that is the answer.',
      ],
      note: '<b>Why it matters:</b> it is always correct and easy to trust, but the work <b>doubles with every extra station</b>. Try the “Long highway” preset to watch the subset count explode.',
    },
    {
      id: 'greedy', name: 'Greedy', color: 'var(--c-greedy)',
      tagline: 'At every step, drive as far as possible before charging.',
      time: 'O(n)', timeWhy: 'After sorting, one left-to-right pass looks at each station once. (Sorting, O(n log n), is shared by all four methods.)',
      space: 'O(1)', spaceWhy: 'Only the current position is remembered, apart from the list of chosen stops.',
      steps: [
        '<b>Sort</b> the stations by distance and start at 0 km with a full battery.',
        'If the <b>destination is within range</b> from where you are, you are done.',
        'Otherwise look at all stations you can reach and pick the <b>farthest one</b>. This is the greedy choice: “go as far as you can”.',
        '<b>Charge there</b>, then repeat from that station.',
        'If <b>no station is reachable</b>, the trip is impossible.',
      ],
      note: '<b>Caveat:</b> greedy finds the route with the <b>fewest stops</b>, but it never looks at <b>price</b>. The farthest station can be the most expensive, so greedy is fast but <b>not always the cheapest</b>.',
    },
    {
      id: 'dp', name: 'Dynamic Programming', color: 'var(--c-dp)',
      tagline: 'Build a table of the cheapest way to reach every station, reusing earlier answers.',
      time: 'O(n²)', timeWhy: 'For each of the n stations we look back at up to n earlier stations.',
      space: 'O(n)', spaceWhy: 'One table entry (and one parent pointer) per station.',
      steps: [
        '<b>Sort</b> the stations. Treat the start as station 0 with cost 0.',
        'Define <b>minCost[i]</b> = the cheapest total cost to arrive at station i and recharge there.',
        'Set <b>minCost[0] = 0</b>. For each station i in order, check every earlier point j that is within range: <b>candidate = minCost[j] + price of i</b>. Keep the smallest and remember j (its “parent”).',
        'For the destination, take the smallest minCost[j] among the points from which the <b>destination is in range</b>.',
        '<b>Rebuild the route</b> by following the parent pointers backwards from that point to the start.',
      ],
      note: '<b>Key idea:</b> the cheapest way to reach a station is built from the cheapest ways to reach earlier stations (<b>optimal substructure</b>). Each sub-problem is solved <b>once</b> and saved in the table instead of being recomputed.',
    },
    {
      id: 'backtracking', name: 'Backtracking', color: 'var(--c-back)',
      tagline: 'Build routes one stop at a time and abandon any path that cannot win.',
      time: 'O(2ⁿ) worst case', timeWhy: 'In the worst case every subset is explored, but pruning skips most branches in practice.',
      space: 'O(n)', spaceWhy: 'The recursion is at most n levels deep; the current path is the only extra storage.',
      steps: [
        '<b>Sort</b> the stations. Start at 0 km with an empty route and cost 0.',
        'If the <b>destination is reachable</b> from here, the route is complete: save it if it is cheaper than the best so far, then go back (more stops would only add cost).',
        'Otherwise try each <b>reachable next station</b> (farthest first): add it to the route, add its price, and <b>recurse</b>.',
        '<b>Prune:</b> if the route’s cost is already more than the best complete route, abandon this branch — it can never win.',
        '<b>Undo</b> the last choice (this is the “backtrack”) and try the next option. When every option has been tried, the best saved route is the answer.',
      ],
      note: '<b>Why it beats brute force:</b> it never builds invalid routes and cuts off hopeless branches early. Compare “Nodes visited” here with “Subsets checked” in Brute Force.',
    },
  ];
  const BY_ID = Object.fromEntries(APPROACHES.map((a) => [a.id, a]));

  /* ------------------------------- presets ------------------------------- */
  const PRESETS = {
    demo: { distance: 345, range: 160, stations: [['Sriperumbudur', 45, 240], ['Walajapet', 110, 160], ['Vellore', 150, 580], ['Ambur', 195, 190], ['Krishnagiri', 250, 210], ['Hosur', 305, 260]] },
    big: {
      distance: 900, range: 250,
      stations: [[55, 310], [110, 180], [170, 520], [225, 240], [280, 150], [340, 460], [395, 210], [450, 170], [510, 540], [565, 230], [620, 190], [680, 480], [735, 220], [790, 160], [840, 300]]
        .map(([p, c], i) => ['Charger ' + (i + 1), p, c]),
    },
    short: { distance: 120, range: 200, stations: [['Highway Plaza', 60, 180]] },
    gap: { distance: 400, range: 150, stations: [['Station A', 100, 200], ['Station B', 320, 150]] },
  };

  /* ------------------------------- DOM refs ------------------------------- */
  const form = $('#trip-form');
  const distanceEl = $('#distance');
  const rangeEl = $('#range');
  const stationsEl = $('#stations');
  const countEl = $('#station-count');
  const addBtn = $('#add-station');
  const solveBtn = $('#solve-btn');
  const bannerEl = $('#error-banner');
  const resultsEl = $('#results');
  const tabsEl = $('#tabs');
  const indicator = $('#tab-indicator');
  const panelsEl = $('#panels');
  const navResults = $('#nav-results');

  const state = { trip: null, results: {}, active: null };

  /* =====================================================================
     1. THE STATIONS TABLE (add / remove rows)
     ===================================================================== */
  const head = document.createElement('div');
  head.className = 'st-head';
  head.innerHTML = '<span>Station name</span><span>Position</span><span>Charging cost</span><span></span>';
  const emptyNote = document.createElement('div');
  emptyNote.className = 'empty-note';
  emptyNote.textContent = 'No stations yet — add one below. (A trip that fits in a single battery needs none.)';
  stationsEl.append(head, emptyNote);

  const rows = () => $$('.st-row', stationsEl);

  function syncTable() {
    const n = rows().length;
    head.hidden = n === 0;
    emptyNote.hidden = n > 0;
    countEl.textContent = `${n} / ${MAX}`;
    addBtn.disabled = n >= MAX;
  }

  function addRow(name = '', pos = '', cost = '', focus = false) {
    if (rows().length >= MAX) return;
    const row = document.createElement('div');
    row.className = 'st-row';
    row.innerHTML =
      `<input type="text" class="st-name" placeholder="Name (optional)" aria-label="Station name" maxlength="40" value="${esc(name)}">` +
      `<div class="input-wrap"><input type="number" class="st-pos" inputmode="decimal" step="any" placeholder="e.g. 110" aria-label="Station position in km" value="${esc(pos)}"><span class="unit">km</span></div>` +
      `<div class="input-wrap"><input type="number" class="st-cost" inputmode="decimal" step="any" placeholder="e.g. 160" aria-label="Charging cost in rupees" value="${esc(cost)}"><span class="unit">₹</span></div>` +
      '<button type="button" class="icon-btn remove" aria-label="Remove this station">✕</button>' +
      '<p class="field-error row-error"></p>';
    stationsEl.insertBefore(row, emptyNote);
    syncTable();
    if (focus) $('.st-name', row).focus();
  }

  function clearRows() { rows().forEach((r) => r.remove()); syncTable(); }

  stationsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove');
    if (!btn) return;
    const row = btn.closest('.st-row');
    row.classList.add('leaving');
    setTimeout(() => { row.remove(); syncTable(); clearErrors(); updatePreview(); }, reduceMotion ? 0 : 220);
  });

  addBtn.addEventListener('click', () => { addRow('', '', '', true); updatePreview(); });
  $('#clear-all').addEventListener('click', () => {
    distanceEl.value = ''; rangeEl.value = '';
    clearRows(); clearErrors(); updatePreview();
  });

  /* =====================================================================
     2. READING THE FORM + SHOWING VALIDATION ERRORS
     ===================================================================== */
  // A <input type="number"> returns "" for junk like "abc"; badInput tells us it was junk, not empty.
  const val = (input) => (input.validity && input.validity.badInput ? 'invalid' : input.value);

  function readForm() {
    return {
      distance: val(distanceEl),
      range: val(rangeEl),
      stations: rows().map((r) => ({ name: $('.st-name', r).value, pos: val($('.st-pos', r)), cost: val($('.st-cost', r)) })),
    };
  }

  function clearErrors() {
    $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
    $$('.field-error', form).forEach((el) => { el.textContent = ''; });
    bannerEl.hidden = true;
  }

  function showErrors(errors) {
    clearErrors();
    const lines = [];
    errors.forEach((e) => {
      if (e.field === 'distance' || e.field === 'range') {
        $('#' + e.field).classList.add('invalid');
        $('#err-' + e.field).textContent = e.message;
        lines.push(e.message);
      } else if (e.field === 'stations') {
        $('#err-stations').textContent = e.message;
        lines.push(e.message);
      } else if (e.field.startsWith('row:')) {
        const [, i, key] = e.field.split(':');
        const row = rows()[Number(i)];
        if (!row) return;
        $('.st-' + key, row).classList.add('invalid');
        const p = $('.row-error', row);
        p.textContent = p.textContent ? p.textContent + ' · ' + e.message : e.message;
        const label = $('.st-name', row).value.trim() || `Station ${Number(i) + 1}`;
        lines.push(`${label}: ${e.message}`);
      } else {
        lines.push(e.message);   // 'route' error: the trip is impossible with this range
      }
    });
    const impossible = errors.some((e) => e.field === 'route');
    $('#banner-title').textContent = impossible
      ? 'This trip cannot be completed with the current range'
      : lines.length === 1 ? 'There is 1 problem with your input' : `There are ${lines.length} problems with your input`;
    $('#banner-list').innerHTML = lines.slice(0, 6).map((l) => `<li>${esc(l)}</li>`).join('') +
      (lines.length > 6 ? `<li>…and ${lines.length - 6} more.</li>` : '');
    bannerEl.hidden = false;
  }

  // typing in a field removes its own error
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (el.classList.contains('invalid')) {
      el.classList.remove('invalid');
      const row = el.closest('.st-row');
      if (row) { if (!$('.invalid', row)) $('.row-error', row).textContent = ''; }
      else if (el.id) { const err = $('#err-' + el.id); if (err) err.textContent = ''; }
      if (!$('.invalid', form)) bannerEl.hidden = true;
    }
    updatePreview();
  });

  /* =====================================================================
     3. PRESETS
     ===================================================================== */
  function loadPreset(key, quiet) {
    const p = PRESETS[key];
    if (!p) return;
    distanceEl.value = p.distance;
    rangeEl.value = p.range;
    clearRows();
    p.stations.forEach(([n, pos, cost]) => addRow(n, pos, cost));
    clearErrors();
    updatePreview();
    if (key === 'gap') showErrors(A.validate(readForm()).errors);   // show what a validation error looks like
    if (!quiet) { form.classList.remove('flash'); void form.offsetWidth; form.classList.add('flash'); }
  }
  $$('.chip[data-preset]').forEach((c) => c.addEventListener('click', () => loadPreset(c.dataset.preset)));

  /* =====================================================================
     4. ROUTE DRAWING + ANIMATED TRIP
     ===================================================================== */
  const CAR_SVG = '<svg viewBox="0 0 48 24" width="46" height="23"><path d="M3 17v-4c0-1.6 1.1-2.9 2.6-3.2l5.8-1.2 4-4.2c.6-.6 1.3-.9 2.1-.9h11c.9 0 1.8.4 2.4 1l4.6 4.3 5.4 1.1c1.6.3 2.8 1.7 2.8 3.3v3.8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2z" fill="currentColor"/><path d="m18 5.5-3.3 3.6h8.8V5.5zM25.5 5.5v3.6h7.3l-3.9-3.6z" fill="#060913" opacity=".55"/><circle cx="14" cy="19" r="3.4" fill="#060913" stroke="currentColor" stroke-width="1.6"/><circle cx="35" cy="19" r="3.4" fill="#060913" stroke="currentColor" stroke-width="1.6"/></svg>';

  function stopTrip(el) {
    if (el && el._raf) cancelAnimationFrame(el._raf);
    if (el) el._raf = null;
  }

  // Draws the road, stations and (optionally) the car + battery HUD.
  function renderRoute(el, trip, stops, opts = {}) {
    stopTrip(el);
    const D = trip.distance, R = trip.range;
    const pct = (p) => (p / D) * 100;
    const sorted = trip.stations.slice().sort((a, b) => a.pos - b.pos);
    const chosen = new Set(stops.map((s) => s.pos));
    const pts = [0, ...stops.map((s) => s.pos), D];

    let html = '<div class="route"><div class="route-track"><div class="route-road"></div>';
    const seg = (a, b, cls, delay) => `<div class="route-seg ${cls}" style="left:${pct(a)}%;width:${pct(b - a)}%;--d:${delay}s"></div>`;

    if (opts.preview) {
      const all = [0, ...sorted.map((s) => s.pos), D];
      for (let k = 0; k < all.length - 1; k++) {
        const bad = R > 0 && all[k + 1] - all[k] > R + 1e-9;      // gap longer than the battery range
        html += seg(all[k], all[k + 1], bad ? 'bad' : '', 0);
      }
    } else {
      for (let k = 0; k < pts.length - 1; k++) html += seg(pts[k], pts[k + 1], '', k * 0.18);
    }

    // delay (optional) staggers the pop-in animation of chosen stops
    const node = (cls, p, title, sub, up, tip, attrs = '', delay = null) =>
      `<div class="route-node ${cls}" style="left:${pct(p)}%${delay === null ? '' : `;--d:${delay}s`}" ${attrs} ${tip ? `title="${esc(tip)}"` : ''}><span class="dot"></span>` +
      (title ? `<span class="lbl ${up ? 'up' : 'down'}"><b>${esc(title)}</b><small>${sub}</small></span>` : '') + '</div>';

    html += node('start', 0, 'Start', '0 km', false);
    let flip = 0, order = 0;
    sorted.forEach((s) => {
      const tip = `${s.name} · ${km(s.pos)} · ${inr(s.cost)}`;
      if (!opts.preview && chosen.has(s.pos)) {
        const near = pct(s.pos) < 15 || pct(s.pos) > 85;
        const up = near ? true : flip % 2 === 0;
        flip++;
        html += node('stop chosen', s.pos, s.name, `${km(s.pos)} · ${inr(s.cost)}`, up, tip, `data-pos="${s.pos}"`, 0.25 + order * 0.18);
        order++;
      } else {
        html += node('stop', s.pos, '', '', false, tip);
      }
    });
    html += node('end', D, 'Destination', km(D), false);

    if (opts.car) html += `<div class="car" style="left:0%">${CAR_SVG}</div>`;
    html += '</div>';
    if (opts.car) {
      html += '<div class="route-hud"><div class="battery"><span class="battery-label">Battery</span>' +
        '<div class="battery-bar"><i></i></div><b class="battery-pct">100%</b></div>' +
        '<div class="hud-status">Ready to drive…</div></div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  // Animates the car along the chosen route; the battery drains while driving and refills at each stop.
  function playTrip(el, trip, stops, totalCost) {
    const car = $('.car', el);
    if (!car) return;
    const fill = $('.battery-bar i', el), pctEl = $('.battery-pct', el), status = $('.hud-status', el);
    const D = trip.distance, R = trip.range;
    const pts = [0, ...stops.map((s) => s.pos), D];

    // Build a timeline of "drive" and "charge" steps.
    const tl = [];
    let t = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const len = pts[k + 1] - pts[k];
      const dur = Math.max(550, (len / D) * 4200);
      const b1 = 100 - (len / R) * 100;
      tl.push({ type: 'drive', t0: t, t1: t + dur, from: pts[k], to: pts[k + 1], b1, label: k === 0 ? 'Driving from the start…' : `Driving on from ${stops[k - 1].name}…` });
      t += dur;
      if (k < pts.length - 2) {
        tl.push({ type: 'charge', t0: t, t1: t + 900, at: pts[k + 1], b0: b1, label: `⚡ Charging at ${stops[k].name} · ${inr(stops[k].cost)}` });
        t += 900;
      }
    }
    const total = t;
    const lastGap = D - pts[pts.length - 2];

    const setBattery = (v) => {
      const p = Math.max(0, Math.min(100, v));
      fill.style.width = p + '%';
      fill.className = p > 50 ? '' : p > 20 ? 'mid' : 'low';
      pctEl.textContent = Math.round(p) + '%';
    };
    const finish = () => {
      car.style.left = '100%';
      setBattery(100 - (lastGap / R) * 100);
      $$('.route-node.charging', el).forEach((n) => n.classList.remove('charging'));
      status.textContent = `Arrived ✔  ${stops.length} stop${stops.length === 1 ? '' : 's'} · total ${inr(totalCost)}`;
      status.classList.add('done');
    };

    setBattery(100);
    status.classList.remove('done');
    if (reduceMotion) { finish(); return; }

    const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const start = performance.now();
    function frame(now) {
      const e = now - start;
      if (e >= total) { finish(); return; }
      const step = tl.find((s) => e >= s.t0 && e < s.t1) || tl[tl.length - 1];
      const p = (e - step.t0) / (step.t1 - step.t0);
      $$('.route-node.charging', el).forEach((n) => n.classList.remove('charging'));
      if (step.type === 'drive') {
        const q = ease(p);
        car.style.left = ((step.from + (step.to - step.from) * q) / D) * 100 + '%';
        setBattery(100 + (step.b1 - 100) * q);
      } else {
        car.style.left = (step.at / D) * 100 + '%';
        setBattery(step.b0 + (100 - step.b0) * p);
        const n = $(`.route-node[data-pos="${step.at}"]`, el);
        if (n) n.classList.add('charging');
      }
      if (status.textContent !== step.label) status.textContent = step.label;
      el._raf = requestAnimationFrame(frame);
    }
    el._raf = requestAnimationFrame(frame);
  }

  /* live preview under the form */
  function updatePreview() {
    const raw = readForm();
    const el = $('#preview');
    const D = parseFloat(raw.distance), R = parseFloat(raw.range);
    if (!(D > 0)) {
      el.innerHTML = '<p class="preview-empty">Enter a trip distance to see a live route preview.</p>';
      return;
    }
    const stations = raw.stations
      .map((s, i) => ({ name: s.name.trim() || `Station ${i + 1}`, pos: parseFloat(s.pos), cost: parseFloat(s.cost) || 0 }))
      .filter((s) => s.pos > 0 && s.pos < D);
    renderRoute(el, { distance: D, range: R, stations }, [], { preview: true });
  }

  /* =====================================================================
     5. SOLVING + BUILDING THE RESULTS SECTION
     ===================================================================== */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = A.validate(readForm());
    if (!v.ok) {
      showErrors(v.errors);
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      const first = $('.invalid', form);
      (first || bannerEl).scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      if (first) first.focus({ preventScroll: true });
      return;
    }
    clearErrors();
    solveBtn.classList.add('loading');
    $('.btn-label', solveBtn).textContent = 'Solving with 4 algorithms…';
    setTimeout(() => {
      try {
        const results = APPROACHES.map((a) => A.run(a.id, v.trip));   // same data, four algorithms
        buildResults(v.trip, results);
      } finally {
        solveBtn.classList.remove('loading');
        $('.btn-label', solveBtn).textContent = 'Find the cheapest plan';
      }
    }, reduceMotion ? 0 : 420);
  });

  function buildResults(trip, results) {
    // Which result(s) achieve the minimum cost?
    const feasible = results.filter((r) => r.feasible);
    const minCost = feasible.length ? Math.min(...feasible.map((r) => r.totalCost)) : 0;
    results.forEach((r) => { r.optimal = r.feasible && r.totalCost <= minCost + 1e-9; r.extra = r.totalCost - minCost; });

    state.trip = trip;
    state.results = Object.fromEntries(results.map((r) => [r.id, r]));

    resultsEl.hidden = false;
    navResults.hidden = false;

    buildInsight(trip, results, minCost);

    // tabs
    $$('.tab', tabsEl).forEach((t) => t.remove());
    APPROACHES.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.id = 'tab-' + a.id; b.dataset.id = a.id;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'panel-' + a.id); b.setAttribute('aria-selected', 'false');
      b.style.setProperty('--accent', a.color);
      b.innerHTML = `<span class="tab-num">0${i + 1}</span><span class="tab-name">${a.name}</span><span class="tab-cx">${a.time}</span>`;
      tabsEl.appendChild(b);
    });

    // panels
    panelsEl.innerHTML = APPROACHES.map((a) => panelHTML(a, state.results[a.id], trip)).join('');

    buildCompare(results);
    activate(APPROACHES[0].id);
    resultsEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function buildInsight(trip, results, minCost) {
    const el = $('#insight');
    const by = Object.fromEntries(results.map((r) => [r.id, r]));
    const g = by.greedy;
    const best = by.dp.optimal ? by.dp : results.find((r) => r.optimal);
    el.className = 'insight';
    if (!best) { el.innerHTML = '<strong>No valid plan.</strong> None of the algorithms could complete this trip.'; return; }
    if (best.stops.length === 0) {
      el.classList.add('ok');
      el.innerHTML = '<strong>No charging stop needed.</strong> One full battery covers the whole trip, so all four algorithms return the same empty plan. Try a longer trip to see them differ.';
    } else if (!g.optimal) {
      el.classList.add('warn');
      const save = Math.round((g.extra / g.totalCost) * 100);
      el.innerHTML = `<strong>Greedy was beaten.</strong> It made ${g.stops.length} stop${g.stops.length === 1 ? '' : 's'} and paid ${inr(g.totalCost)}, but the cheapest plan costs ${inr(minCost)} with ${best.stops.length} stop${best.stops.length === 1 ? '' : 's'} — that saves ${inr(g.extra)} (${save}%). Greedy only looks at <em>distance</em>, never at <em>price</em>. Brute force, dynamic programming and backtracking all agree on the optimum.`;
    } else {
      el.classList.add('ok');
      el.innerHTML = `<strong>All four methods agree: ${inr(minCost)}.</strong> Greedy matched the optimum on this input — it does not always. Load the “Chennai → Bengaluru” preset to see it fall short.`;
    }
  }

  function routeListHTML(trip, r) {
    if (!r.feasible) return '<p class="no-stop">No valid route exists.</p>';
    const items = ['<li class="rl-end"><b>Start</b><small>0 km</small></li>'];
    r.stops.forEach((s) => items.push(`<li class="rl-stop"><b>${esc(s.name)}</b><small>${km(s.pos)} · ${inr(s.cost)}</small></li>`));
    items.push(`<li class="rl-end"><b>Destination</b><small>${km(trip.distance)}</small></li>`);
    return `<ol class="route-list">${items.join('')}</ol>` +
      (r.stops.length === 0 ? '<p class="no-stop">No charging stop needed — one full battery covers the whole trip.</p>' : '');
  }

  function dpTableHTML(r) {
    if (!r.dpTable) return '';
    const onPath = new Set(r.stops.map((s) => s.pos));
    const c = r.dpTable;
    return '<h4>The minCost table</h4><div class="dp-wrap"><table class="dp-table">' +
      `<tr><th class="row-h">Point</th>${c.map((x) => `<th>${esc(x.label)}</th>`).join('')}</tr>` +
      `<tr><td class="row-h">Position</td>${c.map((x) => `<td>${km(x.pos)}</td>`).join('')}</tr>` +
      `<tr><td class="row-h">minCost</td>${c.map((x) => (x.value === Infinity ? '<td class="inf">∞</td>' : `<td class="${x.pos > 0 && onPath.has(x.pos) ? 'on' : ''}">${inr(x.value)}</td>`)).join('')}</tr>` +
      '</table></div><p class="cx-note">Highlighted cells are on the final route. ∞ means that station can never be reached.</p>';
  }

  function panelHTML(a, r, trip) {
    const badge = !r.feasible ? '<span class="badge warn">Impossible</span>'
      : r.optimal ? '<span class="badge good">✔ Cheapest plan</span>'
        : `<span class="badge warn">${inr(r.extra)} more than cheapest</span>`;
    return `
    <article class="panel" role="tabpanel" id="panel-${a.id}" data-id="${a.id}" aria-labelledby="tab-${a.id}" style="--accent:${a.color}" hidden>
      <div class="panel-grid">
        <div class="card explain">
          <div class="card-head"><span class="pill">Approach</span><h4>${a.name}</h4><p class="tagline">${a.tagline}</p></div>
          <h4>How it works — step by step</h4>
          <ol class="steps">${a.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
          <div class="why">${a.note}</div>
          <h4>Complexity</h4>
          <div class="complexity">
            <div class="cx"><span class="cx-label">Time</span><code class="cx-val">${a.time}</code><p>${a.timeWhy}</p></div>
            <div class="cx"><span class="cx-label">Space</span><code class="cx-val">${a.space}</code><p>${a.spaceWhy}</p></div>
          </div>
          <p class="cx-note">n = number of charging stations (here n = ${trip.stations.length}).</p>
        </div>

        <div class="card result">
          <div class="card-head"><h4>Result for your input</h4>${badge}</div>
          <div class="metrics">
            <div class="metric main"><small>Total charging cost</small><b data-count-to="${r.totalCost}" data-fmt="inr">${inr(r.totalCost)}</b></div>
            <div class="metric"><small>Charging stops</small><b data-count-to="${r.stops.length}" data-fmt="int">${r.stops.length}</b></div>
            <div class="metric"><small>Run time</small><b>${fmtTime(r.timeMs)}</b></div>
            ${r.stats.map((s) => `<div class="metric"><small>${s.label}</small><b>${s.value}</b></div>`).join('')}
          </div>
          <h4>Chosen route</h4>
          ${routeListHTML(trip, r)}
          ${dpTableHTML(r)}
          <h4>What happened with your data</h4>
          <ul class="trace">${r.trace.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="card route-card">
        <div class="card-head"><h4>Trip simulation</h4><button type="button" class="btn small ghost replay">↻ Replay trip</button></div>
        <div class="route-view"></div>
      </div>
    </article>`;
  }

  function buildCompare(results) {
    $('#compare-body').innerHTML = results.map((r) => {
      const a = BY_ID[r.id];
      return `<tr style="--accent:${a.color}">
        <td><span class="dot-name"><i></i>${a.name}</span></td>
        <td class="mono">${a.time}</td>
        <td>${r.stops.length}</td>
        <td class="mono">${inr(r.totalCost)}</td>
        <td class="mono">${fmtTime(r.timeMs)}</td>
        <td class="${r.optimal ? 'res-ok' : 'res-warn'}">${r.optimal ? '✔ Cheapest' : '+' + inr(r.extra)}</td></tr>`;
    }).join('');

    const max = Math.max(...results.map((r) => r.totalCost));
    $('#compare-bars').innerHTML = results.map((r) => {
      const a = BY_ID[r.id];
      const w = max > 0 ? (r.totalCost / max) * 100 : 100;
      return `<div class="bar-row" style="--accent:${a.color}"><span class="bar-label">${a.name}</span>` +
        `<div class="bar-track"><div class="bar-fill" data-w="${w}"></div></div><span class="bar-val">${inr(r.totalCost)}</span></div>`;
    }).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('.bar-fill').forEach((b) => { b.style.width = b.dataset.w + '%'; });
    }));
  }

  /* =====================================================================
     6. TABS
     ===================================================================== */
  function positionIndicator() {
    const t = $('.tab[aria-selected="true"]', tabsEl);
    if (!t) return;
    indicator.style.width = t.offsetWidth + 'px';
    indicator.style.height = t.offsetHeight + 'px';
    indicator.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop}px)`;
    indicator.style.setProperty('--accent', t.style.getPropertyValue('--accent'));
  }

  function animateCount(el) {
    const to = parseFloat(el.dataset.countTo);
    const f = el.dataset.fmt === 'inr' ? inr : (v) => String(Math.round(v));
    if (reduceMotion || to === 0) { el.textContent = f(to); return; }
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / 900);
      el.textContent = f(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = f(to);
    })(t0);
  }

  function activate(id) {
    state.active = id;
    $$('.tab', tabsEl).forEach((t) => {
      const on = t.dataset.id === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $$('.panel', panelsEl).forEach((p) => {
      const on = p.dataset.id === id;
      p.hidden = !on;
      p.classList.toggle('show', on);
      if (!on) stopTrip($('.route-view', p));
    });
    positionIndicator();
    const panel = $('#panel-' + id);
    $$('[data-count-to]', panel).forEach(animateCount);
    playPanel(panel);
  }

  function playPanel(panel) {
    const r = state.results[panel.dataset.id];
    const view = $('.route-view', panel);
    if (!r.feasible) { view.innerHTML = '<p class="no-stop">No route to simulate.</p>'; return; }
    renderRoute(view, state.trip, r.stops, { car: true });
    playTrip(view, state.trip, r.stops, r.totalCost);
  }

  tabsEl.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t) activate(t.dataset.id);
  });
  tabsEl.addEventListener('keydown', (e) => {
    const tabs = $$('.tab', tabsEl);
    const i = tabs.findIndex((t) => t.dataset.id === state.active);
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); activate(tabs[n].dataset.id); tabs[n].focus(); }
  });
  panelsEl.addEventListener('click', (e) => {
    if (e.target.closest('.replay')) playPanel(e.target.closest('.panel'));
  });
  window.addEventListener('resize', positionIndicator);

  /* =====================================================================
     7. PAGE POLISH: sticky nav, scroll reveal, hero counters
     ===================================================================== */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function countHero(el) {
    const to = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = to; return; }
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / 1200);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      $$('[data-count]', en.target).forEach(countHero);
      io.unobserve(en.target);
    });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ------------------------------ start-up ------------------------------ */
  navResults.hidden = true;
  loadPreset('demo', true);      // pre-fill the Chennai → Bengaluru example so you can click Solve straight away
})();
