(function () {
  'use strict';
  const { UPS, HARD_ROWS, SOFT_ROWS, decide } = BJ.strategy;
  const $ = (id) => document.getElementById(id);

  // Onglets
  document.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== 'tab-' + t.dataset.tab));
      if (t.dataset.tab === 'sim') window.dispatchEvent(new Event('resize'));
    };
  });

  // Tableaux de stratégie
  const head = '<tr><th class="rl">Ta main</th>' + UPS.map((u) => `<th>${u}</th>`).join('') + '</tr>';
  const cell = (c) => `<td class="c-${c}">${c}</td>`;
  const tbl = (rows) => head + rows.map((r) => `<tr><th class="rl">${r.label}</th>${r.cells.map(cell).join('')}</tr>`).join('');
  $('t-hard').innerHTML = tbl(HARD_ROWS);
  $('t-soft').innerHTML = tbl(SOFT_ROWS);

  // Paires sans split : action dérivée du total, double autorisé (2 premières cartes)
  const pairs = [['A-A', 1], ['10-10', 10], ['9-9', 9], ['8-8', 8], ['7-7', 7], ['6-6', 6], ['5-5', 5], ['4-4', 4], ['3-3', 3], ['2-2', 2]];
  const upRanks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
  $('t-pairs').innerHTML = head + pairs.map(([label, r]) => {
    const d0 = decide([r, r], 10, { surrender: true });
    return `<tr><th class="rl">${label} <small>(${d0.handName.toLowerCase()})</small></th>` +
      upRanks.map((u) => cell(decide([r, r], u, { surrender: true }).raw)).join('') + '</tr>';
  }).join('');

  BJ.sim.init();
  BJ.practice.init();
})();
