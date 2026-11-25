# PhiMycelium R0 — adaptive pocket circulation
Classification: SIMULATED / ANALYZE_ONLY / authority NONE.

A standalone experiment beside E2-R4 through E2-R8. It does not import or modify production routing, execution, signed gates, or authorization. Pocket identity is an integer; the nine-way parent relationship is separate from the undirected communication graph. Golden-angle coordinates are visual metadata only. A Fibonacci schedule helper provides candidate budgets, but R0 uses a fixed 34-pocket fixture; dynamic activation is not yet implemented.

Both policies use identical ring-plus-parent-shortcut topology, costs, ordered seeded demands, and known failed-edge set in the second half of the trace. Static routing minimizes original synthetic cost. Adaptive routing minimizes cost/(1+weight), updates weights after each demand, and decays unused edges; both report original costs and hops. Failed links are excluded, not silently repaired. The adaptive policy has no future workload information. All graph edges are assumed authorized inside this synthetic fixture only.

Run: node --test tests/phi-mycelium-r0.test.mjs
Run demo: node --input-type=module -e "import {experiment} from './src/phi-mycelium-r0.mjs'; const r=experiment(); console.log(JSON.stringify(r,null,2))"

Interpretation: with positive costs, no capacity contention, and full graph visibility, static shortest path is an exact per-demand original-cost baseline. Adaptation cannot beat that baseline on this metric; the experiment establishes a negative control, not evidence of better throughput, memory compression, biology, optics, or real network latency. Reachability is identical for the two policies. Results may expose the cost of reinforcement. No measured advantage is claimed.

Next gate: introduce a predeclared congestion or discovery-cost model with identical observation budgets, multi-seed paired cohorts, fixed edge and node budgets, and explicit edge creation/retirement costs. Compare against grid, random, tree, Fibonacci and golden-angle topologies with matched resources. Then test bounded propagation, procedural generation (Mandelbrot escape-time), and Altermath adapter semantics. No live execution until the existing authorization contract is separately validated.
