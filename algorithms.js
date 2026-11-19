/* =====================================================================
   ChargeRoute — algorithms.js
   ---------------------------------------------------------------------
   THE PROBLEM
   A car with a battery range of R km starts at 0 km with a FULL battery
   and must reach a destination D km away. Charging stations stand at
   known positions; stopping at a station fully recharges the battery
   and costs that station's price. We must choose which stations to stop
   at so that:
     1. no gap (start -> stop, stop -> stop, stop -> destination) is
        longer than R km, and
     2. the TOTAL charging cost is as small as possible.

   FOUR WAYS TO SOLVE IT (all in this file, no UI code here):
     bruteForce            - try every subset of stations
     greedy                - always drive to the farthest reachable station
     dynamicProgramming    - minCost table built from earlier stations
     backtracking          - recursive search that prunes hopeless paths

   This file has no dependency on the browser, so it can also be tested
   in Node.js (see README -> "Testing the algorithms").
   ===================================================================== */
(function (root) {
  'use strict';

  const EPS = 1e-9;                         // tolerance for decimal comparisons
  const LIMITS = {
    MAX_STATIONS: 20,                       // brute force needs 2^n steps, so cap n
    MAX_DISTANCE: 5000,
    MAX_RANGE: 1000,
    MAX_COST: 100000,
  };

  /* ---------------------------- helpers ----------------------------- */

  // Can the car cover this gap on one battery?
  const within = (gap, range) => gap <= range + EPS;

  // Is (cost, count) better than the best so far?
  // Rule: lower cost wins; if costs are equal, fewer stops wins.
  function isBetter(cost, count, bestCost, bestCount) {
    if (cost < bestCost - EPS) return true;
    return Math.abs(cost - bestCost) <= EPS && count < bestCount;
  }

  const round2 = (x) => Math.round(x * 100) / 100;
  const fmt = (n) => Number(Number(n).toFixed(2)).toString();
  const nf = (n) => Number(n).toLocaleString('en-IN');
  const describe = (stops) => (stops.length ? stops.map((s) => s.name).join(' → ') : 'no stops');

  // Copy the trip and sort stations by position (all algorithms rely on this).
  function prepare(trip) {
    return {
      D: Number(trip.distance),
      R: Number(trip.range),
      stations: trip.stations
        .map((s) => ({ name: s.name, pos: Number(s.pos), cost: Number(s.cost) }))
        .sort((a, b) => a.pos - b.pos),
    };
  }

  const sumCost = (stops) => round2(stops.reduce((t, s) => t + s.cost, 0));

  /* ------------------------- input validation ----------------------- */
  // Takes the raw form strings and returns { ok, errors, trip }.
  // Each error has a `field` (which input it belongs to) and a `message`.
  function toNumber(v) {
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim();
    return s === '' ? NaN : Number(s);
  }
  const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

  function validate(raw) {
    const errors = [];
    const add = (field, message) => errors.push({ field, message });

    const D = toNumber(raw.distance);
    const R = toNumber(raw.range);

    // --- trip distance
    if (isBlank(raw.distance)) add('distance', 'Enter the trip distance in km.');
    else if (!Number.isFinite(D)) add('distance', 'Trip distance must be a number.');
    else if (D <= 0) add('distance', 'Trip distance must be greater than 0 km.');
    else if (D > LIMITS.MAX_DISTANCE) add('distance', `Please keep the trip under ${nf(LIMITS.MAX_DISTANCE)} km.`);

    // --- battery range
    if (isBlank(raw.range)) add('range', 'Enter the battery range in km.');
    else if (!Number.isFinite(R)) add('range', 'Battery range must be a number.');
    else if (R <= 0) add('range', 'Battery range must be greater than 0 km.');
    else if (R > LIMITS.MAX_RANGE) add('range', `Battery range above ${nf(LIMITS.MAX_RANGE)} km is not realistic.`);

    const distanceOk = !errors.some((e) => e.field === 'distance');
    const rangeOk = !errors.some((e) => e.field === 'range');

    // --- stations (fully blank rows are simply ignored)
    const rows = [];
    (raw.stations || []).forEach((s, i) => {
      if (isBlank(s.name) && isBlank(s.pos) && isBlank(s.cost)) return;
      rows.push({ i, s });
    });
    if (rows.length > LIMITS.MAX_STATIONS) {
      add('stations', `Too many stations — the maximum is ${LIMITS.MAX_STATIONS}.`);
    }

    const stations = [];
    const seen = new Set();
    rows.forEach(({ i, s }) => {
      const pos = toNumber(s.pos);
      const cost = toNumber(s.cost);
      const before = errors.length;

      if (isBlank(s.pos)) add(`row:${i}:pos`, 'Enter the position in km.');
      else if (!Number.isFinite(pos)) add(`row:${i}:pos`, 'Position must be a number.');
      else if (pos <= 0) add(`row:${i}:pos`, 'Position must be after the start (more than 0 km).');
      else if (distanceOk && pos >= D) add(`row:${i}:pos`, `Position must be before the destination (less than ${fmt(D)} km).`);
      else if (seen.has(pos)) add(`row:${i}:pos`, `Another station is already at ${fmt(pos)} km.`);

      if (isBlank(s.cost)) add(`row:${i}:cost`, 'Enter the charging cost.');
      else if (!Number.isFinite(cost)) add(`row:${i}:cost`, 'Cost must be a number.');
      else if (cost < 0) add(`row:${i}:cost`, 'Cost cannot be negative.');
      else if (cost > LIMITS.MAX_COST) add(`row:${i}:cost`, `Cost looks too high (max ₹${nf(LIMITS.MAX_COST)}).`);

      if (errors.length === before) {
        seen.add(pos);
        const name = isBlank(s.name) ? `Station ${i + 1}` : String(s.name).trim().slice(0, 40);
        stations.push({ name, pos, cost });
      }
    });

    // --- reachability: only check once everything else is valid
    if (errors.length === 0) {
      stations.sort((a, b) => a.pos - b.pos);
      const pts = [{ name: 'the start', pos: 0 }, ...stations, { name: 'the destination', pos: D }];
      let reported = 0;
      for (let k = 0; k < pts.length - 1 && reported < 3; k++) {
        const gap = pts[k + 1].pos - pts[k].pos;
        if (!within(gap, R)) {
          add('route',
            `The car cannot get from ${pts[k].name} (${fmt(pts[k].pos)} km) to ${pts[k + 1].name} (${fmt(pts[k + 1].pos)} km): ` +
            `that is a ${fmt(gap)} km gap but the range is only ${fmt(R)} km. Add a station in between or increase the range.`);
          reported++;
        }
      }
    }

    return { ok: errors.length === 0, errors, trip: { distance: D, range: R, stations } };
  }

  /* ================================================================== */
  /* 1) BRUTE FORCE — test every subset of stations                      */
  /* ================================================================== */
  function bruteForce(trip) {
    const { D, R, stations } = prepare(trip);
    const n = stations.length;
    const total = Math.pow(2, n);              // number of subsets
    let best = { cost: Infinity, count: Infinity, mask: -1 };
    let valid = 0;

    // Each number `mask` from 0 to 2^n - 1 is one subset:
    // bit i of the mask is 1  <=>  we stop at station i.
    for (let mask = 0; mask < total; mask++) {
      let prev = 0, cost = 0, count = 0, ok = true;
      for (let i = 0; i < n; i++) {
        if ((mask >> i) & 1) {
          if (!within(stations[i].pos - prev, R)) { ok = false; break; }   // gap too long
          prev = stations[i].pos;
          cost += stations[i].cost;
          count++;
        }
      }
      if (!ok || !within(D - prev, R)) continue;                            // last gap too long
      valid++;
      if (isBetter(cost, count, best.cost, best.count)) best = { cost, count, mask };
    }

    const feasible = best.mask >= 0;
    const stops = feasible ? stations.filter((_, i) => (best.mask >> i) & 1) : [];
    return {
      id: 'brute', feasible, stops, totalCost: sumCost(stops),
      stats: [
        { label: 'Subsets checked', value: nf(total) },
        { label: 'Valid routes found', value: nf(valid) },
      ],
      trace: [
        `${n} station${n === 1 ? '' : 's'} → 2^${n} = ${nf(total)} subsets to test.`,
        `${nf(valid)} of them were valid (no gap longer than ${fmt(R)} km).`,
        feasible ? `Cheapest valid subset: ${describe(stops)}.` : 'No valid subset exists — the trip is impossible.',
      ],
    };
  }

  /* ================================================================== */
  /* 2) GREEDY — always go to the farthest station you can reach         */
  /* ================================================================== */
  function greedy(trip) {
    const { D, R, stations } = prepare(trip);
    const n = stations.length;
    const stops = [];
    const trace = [`Start at 0 km with a full battery (range ${fmt(R)} km).`];
    let current = 0;   // where the car is now
    let i = 0;         // index of the next station we have not looked at yet
    let feasible = true;

    while (!within(D - current, R)) {            // destination NOT yet reachable
      let best = -1;
      // Stations are sorted, so keep moving forward while they are still in range.
      while (i < n && within(stations[i].pos - current, R)) { best = i; i++; }
      if (best === -1) {                          // nothing reachable: stuck
        feasible = false;
        trace.push(`At ${fmt(current)} km no station is within range — stuck.`);
        break;
      }
      stops.push(stations[best]);
      trace.push(`At ${fmt(current)} km the farthest reachable station is ${stations[best].name} (${fmt(stations[best].pos)} km, ₹${nf(stations[best].cost)}) → stop here.`);
      current = stations[best].pos;
    }
    if (feasible) trace.push(`From ${fmt(current)} km the destination (${fmt(D)} km) is within range → done.`);

    return {
      id: 'greedy', feasible, stops: feasible ? stops : [], totalCost: feasible ? sumCost(stops) : 0,
      stats: [
        { label: 'Stations scanned', value: nf(i) },
        { label: 'Decisions made', value: nf(stops.length) },
      ],
      trace,
    };
  }

  /* ================================================================== */
  /* 3) DYNAMIC PROGRAMMING — minCost table                              */
  /* ================================================================== */
  function dynamicProgramming(trip) {
    const { D, R, stations } = prepare(trip);
    const n = stations.length;

    // Index 0 is the START (0 km, cost 0). Indexes 1..n are the stations.
    const pos = [0, ...stations.map((s) => s.pos)];
    const price = [0, ...stations.map((s) => s.cost)];
    const minCost = new Array(n + 1).fill(Infinity);   // cheapest way to be fully charged at i
    const stopsUsed = new Array(n + 1).fill(Infinity); // tie-breaker: fewer stops
    const parent = new Array(n + 1).fill(-1);          // where we came from (to rebuild the route)
    minCost[0] = 0;
    stopsUsed[0] = 0;

    let checks = 0;
    for (let i = 1; i <= n; i++) {
      for (let j = 0; j < i; j++) {                    // look at every earlier point j
        checks++;
        if (minCost[j] === Infinity || !within(pos[i] - pos[j], R)) continue;
        const cost = minCost[j] + price[i];
        const count = stopsUsed[j] + 1;
        if (isBetter(cost, count, minCost[i], stopsUsed[i])) {
          minCost[i] = cost; stopsUsed[i] = count; parent[i] = j;
        }
      }
    }

    // Finish line: best earlier point j from which the destination is reachable.
    let end = -1, bestCost = Infinity, bestCount = Infinity;
    for (let j = 0; j <= n; j++) {
      if (minCost[j] !== Infinity && within(D - pos[j], R) && isBetter(minCost[j], stopsUsed[j], bestCost, bestCount)) {
        end = j; bestCost = minCost[j]; bestCount = stopsUsed[j];
      }
    }

    // Rebuild the route by walking the parent pointers backwards.
    const stops = [];
    for (let k = end; k > 0; k = parent[k]) stops.unshift(stations[k - 1]);
    const feasible = end !== -1;

    return {
      id: 'dp', feasible, stops: feasible ? stops : [], totalCost: feasible ? sumCost(stops) : 0,
      dpTable: [
        { label: 'Start', pos: 0, value: 0 },
        ...stations.map((s, k) => ({ label: s.name, pos: s.pos, value: minCost[k + 1] })),
      ],
      stats: [
        { label: 'Table cells filled', value: nf(n + 1) },
        { label: 'Range checks', value: nf(checks) },
      ],
      trace: [
        `Table minCost[0..${n}] created; minCost[0] = 0 (the start costs nothing).`,
        `Filled each cell by checking earlier points within ${fmt(R)} km (${nf(checks)} checks in total).`,
        feasible
          ? `Best finishing point: ${end === 0 ? 'the start (no charging needed)' : stations[end - 1].name} with minCost = ₹${nf(round2(bestCost))}.`
          : 'No finishing point can reach the destination — the trip is impossible.',
        feasible ? `Followed parent pointers back to rebuild: ${describe(stops)}.` : '',
      ].filter(Boolean),
    };
  }

  /* ================================================================== */
  /* 4) BACKTRACKING — recursive search with pruning                     */
  /* ================================================================== */
  function backtracking(trip) {
    const { D, R, stations } = prepare(trip);
    const n = stations.length;
    let best = { cost: Infinity, count: Infinity, path: [] };
    let nodes = 0, pruned = 0;
    const path = [];                 // indexes of the stations chosen so far
    const improvements = [];         // log of every time we found a better route

    // lastIdx = index of the last chosen station (-1 = still at the start)
    function explore(lastIdx, lastPos, cost) {
      nodes++;

      // Can we finish from here? Then this is a complete route.
      if (within(D - lastPos, R)) {
        if (isBetter(cost, path.length, best.cost, best.count)) {
          best = { cost, count: path.length, path: path.slice() };
          improvements.push(`New best: ${path.length ? path.map((k) => stations[k].name).join(' → ') : 'no stops'} — ₹${nf(round2(cost))}`);
        }
        return;   // adding more stops can only add cost, so stop going deeper
      }

      // Find the farthest station still in range, then try candidates
      // from the farthest down to the nearest.
      let limit = lastIdx;
      while (limit + 1 < n && within(stations[limit + 1].pos - lastPos, R)) limit++;

      for (let next = limit; next > lastIdx; next--) {
        const newCost = cost + stations[next].cost;
        // PRUNE: costs never go down, so if we already pay more than the best route, give up.
        if (newCost > best.cost + EPS ||
            (Math.abs(newCost - best.cost) <= EPS && path.length + 1 >= best.count)) {
          pruned++;
          continue;
        }
        path.push(next);                                  // choose
        explore(next, stations[next].pos, newCost);       // explore
        path.pop();                                       // un-choose (backtrack)
      }
    }
    explore(-1, 0, 0);

    const feasible = best.cost !== Infinity;
    const stops = feasible ? best.path.map((k) => stations[k]) : [];
    const shown = improvements.slice(0, 6);
    if (improvements.length > shown.length) shown.push(`…and ${improvements.length - shown.length} more improvement(s).`);

    return {
      id: 'backtracking', feasible, stops, totalCost: sumCost(stops),
      stats: [
        { label: 'Nodes visited', value: nf(nodes) },
        { label: 'Branches pruned', value: nf(pruned) },
      ],
      trace: [
        ...shown,
        `Search finished after visiting ${nf(nodes)} node${nodes === 1 ? '' : 's'} and pruning ${nf(pruned)} branch${pruned === 1 ? '' : 'es'}.`,
        ...(feasible ? [] : ['No route reaches the destination — the trip is impossible.']),
      ],
    };
  }

  /* ------------------------------ runner ----------------------------- */
  const ALGORITHMS = { brute: bruteForce, greedy, dp: dynamicProgramming, backtracking };

  function run(id, trip) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const result = ALGORITHMS[id](trip);
    result.timeMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return result;
  }

  const api = { LIMITS, validate, bruteForce, greedy, dynamicProgramming, backtracking, ALGORITHMS, run, isBetter };
  root.ChargeAlgos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
