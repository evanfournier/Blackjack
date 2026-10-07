// Usage : node tests/test.js
require('../js/strategy.js'); require('../js/engine.js');
const { decide, evaluate } = BJ.strategy; const { Shoe, simRound } = BJ.engine;
let fail = 0;
const eq = (name, got, exp) => { if (got !== exp) { fail++; console.log('FAIL', name, 'got', got, 'expected', exp); } };
const A = (h, up, s = true) => decide(h, up, { surrender: s }).action;

// Quelques cases du guide
eq('hard16 v10 surrender', A([10, 6], 10), 'R');
eq('hard16 v10 no surrender', A([10, 6], 10, false), 'H');
eq('hard16 3 cards v10', A([2, 4, 10], 10), 'H');           // abandon impossible après 2 cartes
eq('hard11 v10', A([6, 5], 10), 'D');
eq('hard11 vA', A([6, 5], 1), 'H');
eq('hard12 v4', A([10, 2], 4), 'S');
eq('hard9 v3', A([5, 4], 3), 'D');
eq('soft18 v6 double', A([1, 7], 6), 'D');
eq('soft18 v6 3 cards => stand (Ds)', A([1, 2, 5], 6), 'S');
eq('soft18 v9 hit', A([1, 7], 9), 'H');
eq('soft17 v2 hit', A([1, 6], 2), 'H');
eq('soft19 stand', A([1, 8], 6), 'S');
eq('soft13 v5 double', A([1, 2], 5), 'D');
eq('soft13 v5 3 cards hit', A([1, 1, 1], 5), 'H');
// Paires sans split
eq('8-8 v10 => dur 16 abandon', A([8, 8], 10), 'R');
eq('8-8 v6 => stand', A([8, 8], 6), 'S');
eq('A-A => hit', A([1, 1], 6), 'H');
eq('10-10 stand', A([10, 13], 6), 'S');
eq('9-9 v7 stand', A([9, 9], 7), 'S');
eq('9-9 v6 stand (pas de split)', A([9, 9], 6), 'S');
eq('5-5 v6 double', A([5, 5], 6), 'D');
eq('5-5 v10 hit', A([5, 5], 10), 'H');
eq('4-4 v5 hit', A([4, 4], 5), 'H');
eq('7-7 v8 hit', A([7, 7], 8), 'H');
eq('7-7 v4 stand', A([7, 7], 4), 'S');
eq('evaluate A,A,9', evaluate([1, 1, 9]).total, 21);

// Simulation : avantage maison
const shoe = new Shoe(6), r = {}, o = { surrender: true };
const N = 2000000; let net = 0, wager = 0;
for (let i = 0; i < N; i++) { simRound(shoe, o, r); net += r.net; wager += r.wager; }
console.log('EV/main', (net / N).toFixed(4), ' avantage maison', (-100 * net / N).toFixed(3) + '%');
if (Math.abs(net / N + 0.006) > 0.006) { fail++; console.log('FAIL house edge outside plausible range'); }
console.log(fail ? fail + ' échec(s)' : 'OK');
process.exit(fail ? 1 : 0);
