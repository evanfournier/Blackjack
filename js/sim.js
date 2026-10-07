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
    const cap = $('sim-cap-on').checked;
    if (cap && !(unit > 0)) { alert('Indique une mise unitaire supérieure à 0 pour le mode capital.'); return; }
    const bank0 = cap ? Math.max(1, +$('sim-cap').value || 0) / unit : 0;       // en unités
    const tgtVal = cap ? +$('sim-target').value : 0;
    const target = cap && tgtVal > 0 ? tgtVal / unit : Infinity;                // profit visé, en unités
    const sessions = cap ? Math.max(1, Math.min(1e5, Math.floor(+$('sim-sessions').value) || 1)) : 1;
    const shoe = new Shoe(+$('sim-decks').value);
    const r = {};

    const S = {
      n, total: n * sessions, done: 0, net: 0, sumsq: 0, wager: 0,
      win: 0, loss: 0, push: 0, bj: 0, surrender: 0, bust: 0, dbl: 0,
      upN: new Float64Array(10), upNet: new Float64Array(10),
      curve: [bank0], step: Math.max(1, Math.ceil(n / 300)),
      cap, bank0, target, sessions, sessDone: 0,
      ends: { ruin: 0, target: 0, max: 0 }, sessHands: 0, sessFinal: 0, firstEnd: null,
      lines: cap ? [{ v: 0, color: '#ef6a6a' }].concat(isFinite(target) ? [{ v: bank0 + target, color: '#4cc38a' }] : []) : [],
    };

    // état de la session en cours
    let bank = bank0, sh = 0;
    function endSession(reason) {
      S.ends[reason]++; S.sessHands += sh; S.sessFinal += bank - bank0;
      if (S.sessDone === 0) {
        S.firstEnd = { reason, hands: sh };
        if (S.curve[S.curve.length - 1] !== bank) S.curve.push(bank);
      }
      S.sessDone++; bank = bank0; sh = 0;
    }

    const t0 = performance.now();
    $('sim-run').disabled = true; $('sim-stop').disabled = false;
    $('sim-progress').hidden = false;
    let cancelled = false;
    running = { cancel() { cancelled = true; } };

    function slice() {
      const tEnd = performance.now() + 30;
      while (S.sessDone < sessions && performance.now() < tEnd) {
        for (let k = 0; k < 5000 && S.sessDone < sessions; k++) {
          if (cap && bank < 1) { endSession('ruin'); continue; }
          if (cap && bank - bank0 >= target) { endSession('target'); continue; }
          if (sh >= n) { endSession('max'); continue; }
          simRound(shoe, o, r);
          S.done++; sh++; bank += r.net;
          S.net += r.net; S.sumsq += r.net * r.net; S.wager += r.wager;
          S[r.out]++; if (r.bust) S.bust++; if (r.dbl) S.dbl++;
          S.upN[r.up]++; S.upNet[r.up] += r.net;
          if (S.sessDone === 0 && sh % S.step === 0) S.curve.push(bank);
        }
      }
      $('sim-progress').firstElementChild.style.width = (100 * (S.sessDone + sh / n) / sessions) + '%';
      if (cancelled || S.sessDone >= sessions) return finish();
      setTimeout(slice, 0);
    }

    function finish() {
      running = null;
      $('sim-run').disabled = false; $('sim-stop').disabled = true;
      $('sim-progress').hidden = true;
      if (S.sessDone === 0 && S.curve[S.curve.length - 1] !== bank) S.curve.push(bank); // arrêt manuel
      render(S, unit, o, (performance.now() - t0) / 1000);
    }
    setTimeout(slice, 0);
  }

  const REASONS = {
    ruin: 'ruine : plus assez de capital pour miser',
    target: 'objectif de profit atteint',
    max: 'nombre maximum de mains atteint',
  };

  function render(S, unit, o, secs) {
    if (!S.done) return;
    const N = S.done;
    const ev = S.net / N;
    const sd = Math.sqrt(Math.max(0, S.sumsq / N - ev * ev));
    const ci = 1.96 * sd / Math.sqrt(N);
    const kpi = (label, value, cls) => `<div class="kpi ${cls || ''}"><b>${value}</b><span>${label}</span></div>`;
    $('sim-results').hidden = false;
    let html = '';
    if (S.cap) {
      if (S.sessions === 1 && S.firstEnd) {
        const f = S.firstEnd;
        html += kpi('Fin de session : ' + REASONS[f.reason] + ` (après ${fmt(f.hands)} mains)`,
          f.reason === 'target' ? 'Objectif atteint ✔' : f.reason === 'ruin' ? 'Ruine ✘' : 'Limite de mains',
          f.reason === 'target' ? 'pos' : f.reason === 'ruin' ? 'neg' : '');
      } else if (S.sessDone) {
        const sd_ = S.sessDone, pc = (c) => pct(c / sd_, 1);
        html += kpi(`Sessions terminées sur ${fmt(S.sessions)} — objectif atteint`, pc(S.ends.target), 'pos') +
          kpi('Sessions finies en ruine', pc(S.ends.ruin), 'neg') +
          kpi('Sessions arrêtées à la limite de mains', pc(S.ends.max)) +
          kpi('Durée moyenne d\'une session', fmt(S.sessHands / sd_, 0) + ' mains');
      }
      if (S.sessDone) {
        const avg = (S.sessFinal / S.sessDone) * unit;
        html += kpi('Gain moyen par session', eur(avg), avg >= 0 ? 'pos' : 'neg');
      }
    }
    html +=
      kpi('Mains jouées', fmt(N) + (N < S.total && !S.cap ? ` / ${fmt(S.total)}` : '')) +
      kpi(S.cap && S.sessions > 1 ? 'Résultat net cumulé (toutes sessions)' : 'Résultat net',
        `${S.net >= 0 ? '+' : '−'}${fmt(Math.abs(S.net), 1)} u · ${eur(S.net * unit)}`, S.net >= 0 ? 'pos' : 'neg') +
      kpi('Espérance par main', `${ev >= 0 ? '+' : '−'}${fmt(Math.abs(ev), 4)} u`, ev >= 0 ? 'pos' : 'neg') +
      kpi('Avantage maison mesuré', `${pct(-ev, 3)} <small>±${pct(ci, 3)}</small>`) +
      kpi('Écart-type par main', fmt(sd, 3) + ' u') +
      kpi('Mises engagées', fmt(S.wager) + ' u (' + eur(S.wager * unit).slice(1) + ')') +
      kpi('Temps de calcul', fmt(secs, 2) + ' s');
    $('sim-kpis').innerHTML = html;

    const row = (label, c, extra) =>
      `<tr><td>${label}</td><td>${fmt(c)}</td><td>${pct(c / N)}</td>${extra || ''}</tr>`;
    $('sim-outcomes').innerHTML =
      '<tr><th>Issue</th><th>Mains</th><th>%</th></tr>' +
      row('Victoires', S.win) + row('Défaites', S.loss) + row('Égalités', S.push) +
      row('Blackjacks (3:2)', S.bj) + row('Abandons', S.surrender) +
      '<tr><td colspan="3" style="padding-top:12px"></td></tr>' +
      row('Dont : joueur a sauté', S.bust) + row('Dont : mains doublées', S.dbl);

    let t = '<tr><th>Croupier</th><th>Mains</th><th>Net (u)</th><th>EV / main</th></tr>';
    for (let i = 0; i < 10; i++) {
      const e = S.upN[i] ? S.upNet[i] / S.upN[i] : 0;
      t += `<tr><td>${UPS[i]}</td><td>${fmt(S.upN[i])}</td><td>${fmt(S.upNet[i], 1)}</td>` +
        `<td style="color:var(--${e >= 0 ? 'good' : 'bad'})">${e >= 0 ? '+' : '−'}${fmt(Math.abs(e), 3)}</td></tr>`;
    }
    $('sim-byup').innerHTML = t;
    $('sim-curve-title').textContent = S.cap
      ? 'Évolution du capital' + (S.sessions > 1 ? ' (première session)' : '')
      : 'Évolution du bankroll';
    drawCurve($('sim-canvas'), S.curve, S.step, unit, S.lines);
  }

  function drawCurve(cv, pts, step, unit, lines) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = 260;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    c.clearRect(0, 0, W, H);
    const padL = 64, padB = 22, padT = 8, padR = 8;
    const ref = pts[0];
    const extra = (lines || []).map((l) => l.v);
    let min = Math.min(ref, ...pts, ...extra), max = Math.max(ref, ...pts, ...extra);
    if (min === max) { max += 1; min -= 1; }
    const x = (i) => padL + (W - padL - padR) * i / Math.max(1, pts.length - 1);
    const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
    c.font = '12px system-ui'; c.fillStyle = '#9bb5a8'; c.strokeStyle = '#2a4a3b'; c.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = min + (max - min) * k / 4, yy = y(v);
      c.beginPath(); c.moveTo(padL, yy); c.lineTo(W - padR, yy); c.stroke();
      c.textAlign = 'right'; c.fillText(fmt(v * unit, 0) + ' €', padL - 6, yy + 4);
    }
    const hline = (v, color) => {
      c.strokeStyle = color; c.lineWidth = 1.5; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(padL, y(v)); c.lineTo(W - padR, y(v)); c.stroke(); c.setLineDash([]);
    };
    hline(ref, '#e8b94a');
    (lines || []).forEach((l) => hline(l.v, l.color));
    c.strokeStyle = pts[pts.length - 1] >= ref ? '#4cc38a' : '#ef6a6a'; c.lineWidth = 2;
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
      $('sim-cap-on').onchange = () => { $('sim-cap-opts').hidden = !$('sim-cap-on').checked; };
      $('sim-presets').onclick = (e) => { if (e.target.dataset.n) $('sim-n').value = e.target.dataset.n; };
    },
  };
})();
