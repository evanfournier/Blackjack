/* Outil 1 : simulation de N mains selon la stratégie du guide. */
(function () {
  'use strict';
  const { UPS } = BJ.strategy;
  const { Shoe, simRound } = BJ.engine;
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (x, d = 2) => fmt(x * 100, d) + ' %';
  const eur = (x) => (x >= 0 ? '+' : '−') + fmt(Math.abs(x), 0) + ' €';

  let running = null;

  function start() {
    if (running) return;
    const n = Math.max(1, Math.min(1e8, Math.floor(+$('sim-n').value) || 0));
    $('sim-n').value = n;
    const unit = Math.max(0, +$('sim-unit').value || 0);
    const o = { surrender: $('sim-surr').checked };
    const shoe = new Shoe(+$('sim-decks').value);
    const r = {};

    const S = {
      n, done: 0, net: 0, sumsq: 0, wager: 0,
      win: 0, loss: 0, push: 0, bj: 0, surrender: 0, bust: 0, dbl: 0,
      upN: new Float64Array(10), upNet: new Float64Array(10),
      curve: [0], step: Math.max(1, Math.ceil(n / 300)),
    };

    const t0 = performance.now();
    $('sim-run').disabled = true; $('sim-stop').disabled = false;
    $('sim-progress').hidden = false;
    let cancelled = false;
    running = { cancel() { cancelled = true; } };

    function slice() {
      const tEnd = performance.now() + 30;
      while (S.done < S.n && performance.now() < tEnd) {
        const lim = Math.min(S.n, S.done + 5000);
        for (; S.done < lim; S.done++) {
          simRound(shoe, o, r);
          S.net += r.net; S.sumsq += r.net * r.net; S.wager += r.wager;
          S[r.out]++; if (r.bust) S.bust++; if (r.dbl) S.dbl++;
          S.upN[r.up]++; S.upNet[r.up] += r.net;
          if ((S.done + 1) % S.step === 0) S.curve.push(S.net);
        }
      }
      $('sim-progress').firstElementChild.style.width = (100 * S.done / S.n) + '%';
      if (cancelled || S.done >= S.n) return finish();
      setTimeout(slice, 0);
    }

    function finish() {
      running = null;
      $('sim-run').disabled = false; $('sim-stop').disabled = true;
      $('sim-progress').hidden = true;
      if (S.curve[S.curve.length - 1] !== S.net) S.curve.push(S.net);
      render(S, unit, o, (performance.now() - t0) / 1000);
    }
    setTimeout(slice, 0);
  }

  function render(S, unit, o, secs) {
    if (!S.done) return;
    const N = S.done;
    const ev = S.net / N;
    const sd = Math.sqrt(Math.max(0, S.sumsq / N - ev * ev));
    const ci = 1.96 * sd / Math.sqrt(N);
    const kpi = (label, value, cls) => `<div class="kpi ${cls || ''}"><b>${value}</b><span>${label}</span></div>`;
    $('sim-results').hidden = false;
    $('sim-kpis').innerHTML =
      kpi('Mains jouées', fmt(N) + (N < S.n ? ` / ${fmt(S.n)}` : '')) +
      kpi('Résultat net', `${S.net >= 0 ? '+' : '−'}${fmt(Math.abs(S.net), 1)} u · ${eur(S.net * unit)}`, S.net >= 0 ? 'pos' : 'neg') +
      kpi('Espérance par main', `${ev >= 0 ? '+' : '−'}${fmt(Math.abs(ev), 4)} u`, ev >= 0 ? 'pos' : 'neg') +
      kpi('Avantage maison mesuré', `${pct(-ev, 3)} <small>±${pct(ci, 3)}</small>`) +
      kpi('Écart-type par main', fmt(sd, 3) + ' u') +
      kpi('Mises engagées', fmt(S.wager) + ' u (' + eur(S.wager * unit).slice(1) + ')') +
      kpi('Temps de calcul', fmt(secs, 2) + ' s');

    const row = (label, c, extra) =>
      `<tr><td>${label}</td><td>${fmt(c)}</td><td>${pct(c / N)}</td>${extra || ''}</tr>`;
    $('sim-outcomes').innerHTML =
      '<tr><th>Issue</th><th>Mains</th><th>%</th></tr>' +
      row('Victoires', S.win) + row('Défaites', S.loss) + row('Égalités', S.push) +
      row('Blackjacks (3:2)', S.bj) + row('Abandons', S.surrender) +
      '<tr><td colspan="3" style="padding-top:12px"></td></tr>' +
      row('Dont : joueur a sauté', S.bust) + row('Dont : mains doublées', S.dbl);

    let html = '<tr><th>Croupier</th><th>Mains</th><th>Net (u)</th><th>EV / main</th></tr>';
    for (let i = 0; i < 10; i++) {
      const e = S.upN[i] ? S.upNet[i] / S.upN[i] : 0;
      html += `<tr><td>${UPS[i]}</td><td>${fmt(S.upN[i])}</td><td>${fmt(S.upNet[i], 1)}</td>` +
        `<td style="color:var(--${e >= 0 ? 'good' : 'bad'})">${e >= 0 ? '+' : '−'}${fmt(Math.abs(e), 3)}</td></tr>`;
    }
    $('sim-byup').innerHTML = html;
    drawCurve($('sim-canvas'), S.curve, S.step, unit);
  }

  function drawCurve(cv, pts, step, unit) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = 260;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    c.clearRect(0, 0, W, H);
    const padL = 64, padB = 22, padT = 8, padR = 8;
    let min = Math.min(0, ...pts), max = Math.max(0, ...pts);
    if (min === max) { max += 1; min -= 1; }
    const x = (i) => padL + (W - padL - padR) * i / Math.max(1, pts.length - 1);
    const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
    c.font = '12px system-ui'; c.fillStyle = '#9bb5a8'; c.strokeStyle = '#2a4a3b'; c.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = min + (max - min) * k / 4, yy = y(v);
      c.beginPath(); c.moveTo(padL, yy); c.lineTo(W - padR, yy); c.stroke();
      c.textAlign = 'right'; c.fillText(fmt(v * unit, 0) + ' €', padL - 6, yy + 4);
    }
    c.strokeStyle = '#e8b94a'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(padL, y(0)); c.lineTo(W - padR, y(0)); c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]);
    c.strokeStyle = pts[pts.length - 1] >= 0 ? '#4cc38a' : '#ef6a6a'; c.lineWidth = 2;
    c.beginPath();
    pts.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))));
    c.stroke();
    c.fillStyle = '#9bb5a8'; c.textAlign = 'left'; c.fillText('0', padL, H - 6);
    c.textAlign = 'right'; c.fillText(fmt((pts.length - 1) * step) + ' mains', W - padR, H - 6);
  }

  BJ.sim = {
    init() {
      $('sim-run').onclick = start;
      $('sim-stop').onclick = () => running && running.cancel();
      $('sim-presets').onclick = (e) => { if (e.target.dataset.n) $('sim-n').value = e.target.dataset.n; };
    },
  };
})();
