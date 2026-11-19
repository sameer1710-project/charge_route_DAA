/* =====================================================================
   test.js — checks that the four algorithms agree with each other.
   Run with:   node test.js
   It generates thousands of random trips and verifies:
     • brute force, DP and backtracking always find the SAME minimum cost
     • greedy is never cheaper than that minimum (it can only tie or lose)
     • all four agree on whether a trip is possible, and the validator
       (validate()) agrees with them
   ===================================================================== */
const A = require('./algorithms.js');

const IDS = ['brute', 'greedy', 'dp', 'backtracking'];
const CASES = 3000;
let failures = 0;
let greedyWorse = 0;
let impossible = 0;

const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

for (let t = 0; t < CASES; t++) {
  const range = randInt(50, 200);
  const distance = randInt(20, 500);
  const n = randInt(0, 10);

  const positions = new Set();
  while (positions.size < Math.min(n, distance - 1)) positions.add(randInt(1, distance - 1));
  const stations = [...positions].map((pos, i) => ({ name: 'S' + (i + 1), pos, cost: randInt(0, 500) }));
  const trip = { distance, range, stations };

  const raw = {
    distance: String(distance), range: String(range),
    stations: stations.map((s) => ({ name: s.name, pos: String(s.pos), cost: String(s.cost) })),
  };
  const validation = A.validate(raw);
  const [brute, greedy, dp, back] = IDS.map((id) => A.run(id, trip));

  const fail = (msg) => { failures++; console.log('FAIL:', msg, JSON.stringify(trip)); };

  if (![greedy, dp, back].every((r) => r.feasible === brute.feasible)) { fail('feasibility differs between algorithms'); continue; }
  if (validation.ok !== brute.feasible) { fail('validator disagrees with algorithms'); continue; }
  if (!brute.feasible) { impossible++; continue; }

  const same = (x, y) => Math.abs(x.totalCost - y.totalCost) < 1e-6 && x.stops.length === y.stops.length;
  if (!same(brute, dp) || !same(brute, back)) fail(`optimal methods disagree (${brute.totalCost}, ${dp.totalCost}, ${back.totalCost})`);
  if (greedy.totalCost < brute.totalCost - 1e-6) fail('greedy beat the optimum — impossible');
  if (greedy.totalCost > brute.totalCost + 1e-6) greedyWorse++;
}

const solvable = CASES - impossible;
console.log(`${CASES} random trips (${solvable} solvable, ${impossible} impossible).`);
console.log(`Greedy paid more than the optimum in ${greedyWorse} of ${solvable} solvable trips.`);
console.log(failures === 0 ? 'ALL TESTS PASSED ✔' : `${failures} FAILURE(S) ✘`);
process.exit(failures === 0 ? 0 : 1);
