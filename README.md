# ⚡ ChargeRoute — EV Charging Stop Planner

**Algorithm Explorer project:** one real-world problem, solved with **four different algorithms**, in a small website.

| | |
|---|---|
| **Live site** | `https://<your-username>.github.io/<repo-name>/` ← paste your URL here after deploying |
| **Source code** | `https://github.com/<your-username>/<repo-name>` ← paste your repo link here |

---

## 1. The problem

An electric car starts a long trip with a **full battery** that covers a fixed **range** (km). Charging stations stand at known positions along the road, and each charges a **different price**. Stopping at a station recharges the battery to full.

> **Which stations should the car stop at so that it never runs out of charge _and_ the total charging cost is as low as possible?**

- **Why it matters:** EV adoption is growing, but charging networks are uneven (long gaps, fast-charger price premiums, range anxiety). Navigation apps and fleet/bus/cab operators solve this kind of optimisation every day.
- **What the program computes:** the set of stops (from trip distance, battery range, and a list of stations with position and cost) with no gap longer than the range and the lowest total cost.

**Assumptions:** full battery at the start · each stop recharges to full · each station has one flat price per charge · *n* = number of stations.

---

## 2. How this meets the project requirements

| Requirement | Where it is |
|---|---|
| Intro: what the problem is, why it matters, what is computed | "The problem, in plain words" section (`index.html`) |
| Form to enter data, with validation and clear error messages | "Plan your trip" form; rules in `validate()` in `algorithms.js`, messages shown by `app.js` |
| Four different techniques, switchable | Four tabs: **Brute Force, Greedy, Dynamic Programming, Backtracking** |
| Each tab: step-by-step explanation, complexity, result | Left card = steps + time/space complexity; right card = result for your input |
| Public URL | Deploy steps in section 6 |

---

## 3. Files

```
index.html      page structure (intro, form, results containers)
style.css       dark EV theme, animations, responsive layout
algorithms.js   ALL the logic: validate(), bruteForce(), greedy(), dynamicProgramming(), backtracking()
app.js          the interface: form rows, error messages, tabs, route + car animation
test.js         optional Node script that checks the algorithms against each other
README.md       this file
```

No frameworks, no build step, no dependencies. Everything that solves the problem is in **`algorithms.js`** (no UI code there), which keeps it easy to read and explain.

**Run locally:** just double-click `index.html`. (Fonts load from Google Fonts when online; the site works without them.)
**Test the algorithms:** `node test.js` (needs Node.js; it is optional).

---

## 4. The four algorithms

Stations are first **sorted by position**; every algorithm relies on that. `n` = number of stations.

### 4.1 Brute force — `bruteForce()` — Time `O(2ⁿ · n)`, Space `O(n)`
Every station is ON (we stop) or OFF (we skip), so there are **2ⁿ subsets**. A loop counts `mask` from `0` to `2ⁿ − 1`; the binary digits of `mask` are the ON/OFF switches. For each subset, drive through it: if any gap is longer than the range it is invalid; otherwise add up the costs. Keep the cheapest valid subset (ties → fewer stops).
*Always correct, but the work doubles with every station.* That is why the form allows at most 20 stations.

### 4.2 Greedy — `greedy()` — Time `O(n)` (after sorting), Space `O(1)` extra
From the current position, if the destination is in range, finish. Otherwise charge at the **farthest reachable station** and repeat. A pointer `i` only moves forward, so each station is looked at once.
*Fast, and it uses the fewest stops — but it ignores price, so it is **not always cheapest**.*

### 4.3 Dynamic programming — `dynamicProgramming()` — Time `O(n²)`, Space `O(n)`
`minCost[i]` = cheapest total cost to arrive at and charge at station *i* (index 0 = start, cost 0).
For each station *i*, look at every earlier point *j* within range: `minCost[i] = min( minCost[j] + cost[i] )`, and remember the best *j* in `parent[i]`. The answer is the smallest `minCost[j]` among points from which the destination is in range; follow `parent` pointers backwards to rebuild the route.
*Works because of **optimal substructure** (the cheapest way to reach a station is built from cheapest ways to reach earlier ones) and each sub-problem is solved once and stored.*

### 4.4 Backtracking — `backtracking()` — Time `O(2ⁿ)` worst case, Space `O(n)`
`explore(lastStation, position, costSoFar)` builds a route one stop at a time:
1. If the destination is reachable from here → the route is complete; save it if cheaper; return (more stops only add cost).
2. Otherwise try each reachable next station (farthest first): choose → recurse → **undo (backtrack)**.
3. **Prune:** if `costSoFar` already exceeds the best complete route, abandon the branch.

*Same worst case as brute force, but far fewer nodes in practice (see the numbers below).*

---

## 5. What you will see (verified numbers)

**Chennai → Bengaluru preset** (345 km, range 160 km, 6 stations):

| Algorithm | Stops chosen | Total cost |
|---|---|---|
| Brute force | Walajapet → Ambur | **₹350** |
| Greedy | Vellore → Hosur | **₹840** |
| Dynamic programming | Walajapet → Ambur | **₹350** |
| Backtracking | Walajapet → Ambur | **₹350** |

Greedy jumps to the farthest station (Vellore, ₹580) and pays **₹490 more** — this is the key talking point.

**Long highway preset** (900 km, range 250 km, 15 stations): optimum **₹760** with 4 stops vs greedy **₹890** with 3 stops. Brute force tests **32,768** subsets (20,569 valid); DP does **120** range checks; backtracking visits only **46** nodes.

`node test.js` runs 3,000 random trips: brute force, DP and backtracking always agree, and greedy was costlier in roughly one in three solvable trips.

---

## 6. Input validation

| Check | Message (example) |
|---|---|
| Distance / range empty, not a number, ≤ 0, or too large | "Enter the trip distance in km." / "Battery range must be greater than 0 km." |
| Station position missing, ≤ 0, or ≥ the destination | "Position must be before the destination (less than 345 km)." |
| Two stations at the same position | "Another station is already at 110 km." |
| Station cost missing, not a number, or negative | "Cost cannot be negative." |
| More than 20 stations | "Too many stations — the maximum is 20." |
| **Trip impossible:** a gap between consecutive points is longer than the range | "The car cannot get from Station A (100 km) to Station B (320 km): that is a 220 km gap but the range is only 150 km…" |

Fully blank station rows are ignored. The "Invalid example" preset shows the last error.

---

## 7. Deploy to a public URL (do this from your own account)

### Option A — GitHub Pages (also gives you the source link)
1. Create a free account at github.com and click **New repository** → name it e.g. `chargeroute` → **Public** → Create.
2. Click **Add file → Upload files**, drag in **all 6 files** (`index.html` must be at the top level, not inside a folder), then **Commit changes**.
3. Open **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, then **Save**.
4. After about a minute your site is live at `https://<your-username>.github.io/chargeroute/`.

### Option B — Netlify Drop
Go to `app.netlify.com/drop`, sign in, and drag the project folder in. Netlify gives you a public URL immediately.

**Submit:** the live URL + the GitHub repository link (Option A gives you both).

---

## 8. Viva preparation — be ready to explain these

1. **Why can greedy be wrong here?** It picks the farthest station, which minimises the *number* of stops but ignores *price*. In the demo, Vellore (₹580) is farthest, while two cheap stations (₹160 + ₹190) cost far less.
2. **Why does the DP work?** Optimal substructure: the cheapest way to reach station *i* uses the cheapest way to reach some earlier station *j*. Each `minCost[j]` is computed once and reused by many later stations.
3. **Why is DP `O(n²)`?** For each of the *n* stations it scans up to *n* earlier ones — a nested loop, about n(n+1)/2 checks.
4. **How does the bitmask work in brute force?** Each integer from 0 to 2ⁿ−1 written in binary is one subset: bit *i* = 1 means "stop at station *i*".
5. **Why is brute-force space only `O(n)`?** Subsets are generated one at a time and never stored; we only keep the best one.
6. **Why does backtracking stop as soon as the destination is reachable?** Costs are never negative, so adding more stops cannot make the route cheaper.
7. **What exactly is pruned?** Any partial route whose cost already exceeds the best complete route found so far — it can only get more expensive.
8. **If backtracking has the same worst case as brute force, why use it?** Pruning depends on the data; on typical inputs it skips most branches (46 nodes vs 32,768 subsets in the long-highway example). In the worst case no branch is pruned and it is exponential too.
9. **Why sort the stations first?** Greedy's forward pointer, DP's "only look at earlier stations", backtracking's early `break`, and brute force's gap checking all assume increasing positions.
10. **How are ties handled?** `isBetter()` prefers the lower cost; if equal, the route with fewer stops.
11. **Why limit to 20 stations?** Brute force needs 2ⁿ subsets; 2²⁰ ≈ 1 million subsets × 20 checks is still instant, much more would freeze the page.
12. **Limitations?** The car always charges to full at a flat price per stop. A more realistic model (charge only what you need, price per kWh) needs a DP over *(station, charge level)*.

---

## 9. Team (max 4 members — scoring is individual, so everyone should be able to explain every algorithm)

| Name | Roll no. | Contribution |
|---|---|---|
| | | |
| | | |
| | | |
| | | |
