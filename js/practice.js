/* Outil 2 : jouer contre le croupier, avec correction de chaque décision. */
(function () {
  'use strict';
  const { decide, evaluate, cardVal, ACTION_NAMES } = BJ.strategy;
  const { Shoe } = BJ.engine;
  const $ = (id) => document.getElementById(id);
  const fmt = (x, d = 0) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const SUITS = ['♠', '♥', '♦', '♣'];
  const FACE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const face = (r) => FACE[r] || String(r);
  const KEY = 'bj-trainer-stats-v1';
  const TYPES = { hard: 'Mains dures', soft: 'Mains souples', pair: 'Paires (sans split)' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let shoe = new Shoe(6);
  let st = { phase: 'idle' };        // phase : idle | player | dealer | done
  let hintUsed = false;
  let stats = load();

  function blank() {
    return { decisions: 0, correct: 0, hints: 0, hands: 0, wins: 0, losses: 0, pushes: 0, net: 0,
      types: { hard: [0, 0], soft: [0, 0], pair: [0, 0] },
      actions: { H: [0, 0], S: [0, 0], D: [0, 0], R: [0, 0] }, mistakes: [] };
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.types) return s; } catch (e) { /* ignore */ }
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ } }

  const newCard = () => ({ r: shoe.draw(), s: SUITS[(Math.random() * 4) | 0] });
  const ranks = (h) => h.map((c) => c.r);

  function cardEl(c, hidden) {
    const d = document.createElement('div');
    if (hidden) { d.className = 'pcard back'; return d; }
    d.className = 'pcard' + (c.s === '♥' || c.s === '♦' ? ' red' : '');
    d.innerHTML = `${face(c.r)}<span class="s">${c.s}</span>`;
    return d;
  }
  function render(hideHole) {
    const dEl = $('p-dealer'), pEl = $('p-player');
    dEl.replaceChildren(...(st.dealer || []).map((c, i) => cardEl(c, hideHole && i === 1)));
    pEl.replaceChildren(...(st.player || []).map((c) => cardEl(c)));
    $('p-dealer-total').textContent = st.dealer && !hideHole ? evaluate(ranks(st.dealer)).total : '';
    if (st.player && st.player.length) {
      const e = evaluate(ranks(st.player));
      $('p-player-total').textContent = (e.soft && e.total <= 21 ? 'souple ' : '') + e.total;
    } else $('p-player-total').textContent = '';
  }
  function banner(msg, cls) { const b = $('p-banner'); b.textContent = msg; b.className = 'banner ' + (cls || ''); }
  function feedback(html, cls) {
    const f = $('p-feedback'); f.hidden = !html; f.className = 'feedback ' + (cls || ''); f.innerHTML = html || '';
  }
  function setButtons() {
    const playing = st.phase === 'player';
    const first = playing && st.player.length === 2;
    document.querySelectorAll('#p-actions button').forEach((b) => {
      const a = b.dataset.act;
      b.disabled = !playing || (a === 'D' && !first) || (a === 'R' && !(first && $('p-surr').checked));
    });
    $('p-hint').disabled = !playing;
    $('p-next').disabled = st.phase === 'player' || st.phase === 'dealer';
  }

  async function newHand() {
    if (st.phase === 'player' || st.phase === 'dealer') return;
    if (shoe.needsShuffle()) shoe.reshuffle();
    hintUsed = false; feedback('');
    st = { phase: 'player', player: [], dealer: [], doubled: false, startType: null, startName: '' };
    st.player.push(newCard()); st.dealer.push(newCard());
    st.player.push(newCard()); st.dealer.push(newCard());
    banner(''); $('p-tag').hidden = true;
    render(true);

    const up = st.dealer[0].r;
    const dealerBJ = cardVal(up) >= 10 && evaluate(ranks(st.dealer)).total === 21;
    const playerBJ = evaluate(ranks(st.player)).total === 21;
    if (dealerBJ || playerBJ) {
      st.phase = 'done'; render(false);
      if (dealerBJ && playerBJ) return finish(0, 'Blackjack des deux côtés : égalité.');
      if (playerBJ) return finish(1.5, 'Blackjack ! Tu gagnes 3:2.');
      return finish(-1, 'Le croupier a un blackjack.');
    }
    const d = decide(ranks(st.player), up, { surrender: $('p-surr').checked });
    const tag = $('p-tag');
    if (d.isPair) {
      tag.hidden = false; tag.textContent = `Paire — split interdit, on joue ${d.handName.toLowerCase()}`;
    }
    setButtons();
  }

  function recommended() {
    return decide(ranks(st.player), st.dealer[0].r, { surrender: $('p-surr').checked });
  }
  function explain(d) {
    return `${d.handName} contre ${cardLabel(st.dealer[0].r)}`;
  }
  function cardLabel(r) { return r === 1 ? 'As' : String(Math.min(r, 10)); }

  function hint() {
    if (st.phase !== 'player') return;
    hintUsed = true;
    const d = recommended();
    feedback(`💡 Le guide dit : <b>${ACTION_NAMES[d.action]}</b> (${explain(d)}).`, 'hint');
  }

  async function act(a) {
    if (st.phase !== 'player') return;
    const first = st.player.length === 2;
    if ((a === 'D' && !first) || (a === 'R' && !(first && $('p-surr').checked))) return;
    const d = recommended();
    const ok = a === d.action;

    if (!hintUsed) {
      const type = d.isPair ? 'pair' : d.soft ? 'soft' : 'hard';
      stats.decisions++; if (ok) stats.correct++;
      stats.types[type][0]++; if (ok) stats.types[type][1]++;
      stats.actions[d.action][0]++; if (ok) stats.actions[d.action][1]++;
      if (!ok) {
        stats.mistakes.unshift({ hand: ranks(st.player).map(face).join('-'), name: d.handName,
          up: cardLabel(st.dealer[0].r), played: a, best: d.action });
        stats.mistakes.length = Math.min(stats.mistakes.length, 30);
      }
    } else stats.hints++;
    feedback(ok
      ? `✅ Bon choix : <b>${ACTION_NAMES[a]}</b> (${explain(d)})${hintUsed ? ' — indice utilisé, non compté' : ''}.`
      : `❌ Tu as joué <b>${ACTION_NAMES[a]}</b>, le meilleur choix était <b>${ACTION_NAMES[d.action]}</b> (${explain(d)}, case « ${d.raw} » du guide)${hintUsed ? ' — indice utilisé, non compté' : ''}.`,
      ok ? 'ok' : 'ko');
    hintUsed = false;
    save(); renderStats();

    if (a === 'R') { st.phase = 'done'; render(false); return finish(-0.5, 'Tu abandonnes : −½ mise.'); }
    if (a === 'H' || a === 'D') {
      st.player.push(newCard());
      if (a === 'D') st.doubled = true;
      render(true);
      const tot = evaluate(ranks(st.player)).total;
      if (tot > 21) { st.phase = 'done'; render(false); return finish(st.doubled ? -2 : -1, `Tu as sauté avec ${tot}.`); }
      if (a === 'D' || tot === 21) return dealerPlay();
      setButtons();
      return;
    }
    return dealerPlay();
  }

  async function dealerPlay() {
    st.phase = 'dealer'; setButtons(); render(false);
    while (evaluate(ranks(st.dealer)).total < 17) { // S17
      await sleep(550); st.dealer.push(newCard()); render(false);
    }
    await sleep(300);
    const pt = evaluate(ranks(st.player)).total, dt = evaluate(ranks(st.dealer)).total;
    const bet = st.doubled ? 2 : 1;
    st.phase = 'done';
    if (dt > 21) finish(bet, `Le croupier saute (${dt}) : tu gagnes !`);
    else if (pt > dt) finish(bet, `${pt} contre ${dt} : tu gagnes !`);
    else if (pt < dt) finish(-bet, `${pt} contre ${dt} : tu perds.`);
    else finish(0, `${pt} partout : égalité.`);
  }

  function finish(net, msg) {
    st.phase = 'done';
    stats.hands++; stats.net += net;
    if (net > 0) stats.wins++; else if (net < 0) stats.losses++; else stats.pushes++;
    banner(`${msg} (${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net), net % 1 ? 1 : 0)} mise)`, net > 0 ? 'win' : net < 0 ? 'loss' : '');
    save(); renderStats(); setButtons();
  }

  function renderStats() {
    const acc = stats.decisions ? stats.correct / stats.decisions : null;
    $('st-acc').textContent = acc === null ? '–' : fmt(acc * 100, 1) + ' %';
    $('st-table').innerHTML =
      `<tr><td>Décisions</td><td>${fmt(stats.decisions)}</td></tr>
       <tr><td>Bonnes décisions</td><td>${fmt(stats.correct)}</td></tr>
       <tr><td>Indices utilisés</td><td>${fmt(stats.hints)}</td></tr>
       <tr><td>Mains jouées</td><td>${fmt(stats.hands)}</td></tr>
       <tr><td>Gagnées / perdues / égalités</td><td>${stats.wins} / ${stats.losses} / ${stats.pushes}</td></tr>
       <tr><td>Résultat net</td><td style="color:var(--${stats.net >= 0 ? 'good' : 'bad'})">${stats.net >= 0 ? '+' : '−'}${fmt(Math.abs(stats.net), 1)} mises</td></tr>`;
    const line = (label, [n, c]) => `<tr><td>${label}</td><td>${c} / ${n}</td><td>${n ? fmt(100 * c / n, 0) + ' %' : '–'}</td></tr>`;
    $('st-types').innerHTML = Object.keys(TYPES).map((k) => line(TYPES[k], stats.types[k])).join('');
    $('st-actions').innerHTML = Object.keys(ACTION_NAMES).map((k) => line(ACTION_NAMES[k], stats.actions[k])).join('');
    $('st-mistakes').innerHTML = stats.mistakes.slice(0, 8).map((m) =>
      `<li><b>${m.name}</b> (${m.hand}) vs ${m.up} : joué ${ACTION_NAMES[m.played]}, mieux : ${ACTION_NAMES[m.best]}</li>`).join('')
      || '<li>Aucune pour l\'instant.</li>';
  }

  BJ.practice = {
    init() {
      $('p-next').onclick = newHand;
      $('p-hint').onclick = hint;
      $('p-actions').onclick = (e) => { const b = e.target.closest('button'); if (b && !b.disabled) act(b.dataset.act); };
      $('p-decks').onchange = () => { if (st.phase !== 'player') shoe = new Shoe(+$('p-decks').value); };
      $('p-surr').onchange = setButtons;
      $('st-reset').onclick = () => { if (confirm('Effacer toutes tes statistiques ?')) { stats = blank(); save(); renderStats(); } };
      document.addEventListener('keydown', (e) => {
        if ($('tab-practice').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
        if (/input|select|textarea/i.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if ('hsdr'.includes(k) && k.length === 1) act(k.toUpperCase());
        else if (k === 'n' || k === 'enter') { if (!$('p-next').disabled) { e.preventDefault(); newHand(); } }
        else if (k === '?' || k === 'i') hint();
      });
      renderStats(); setButtons();
    },
  };
})();
