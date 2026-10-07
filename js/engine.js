/* Sabot + simulation d'une main automatique selon la stratégie du guide. */
(function (g) {
  'use strict';
  const BJ = (g.BJ = g.BJ || {});
  const { cardVal, upIndex, evaluate, decide } = BJ.strategy;

  const PENETRATION = 0.75; // le sabot est remélangé après 75 % des cartes

  class Shoe {
    constructor(decks) {
      this.decks = decks;
      this.cards = new Uint8Array(decks * 52);
      for (let i = 0; i < this.cards.length; i++) this.cards[i] = (i % 13) + 1;
      this.cut = Math.floor(this.cards.length * PENETRATION);
      this.reshuffle();
    }
    reshuffle() {
      const c = this.cards;
      for (let i = c.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = c[i]; c[i] = c[j]; c[j] = t;
      }
      this.pos = 0;
    }
    needsShuffle() { return this.pos >= this.cut; }
    draw() { return this.cards[this.pos++]; }
  }

  /* Joue une main complète avec la stratégie du guide (mise de 1 unité, sans assurance,
   * sans split). Le croupier regarde sa carte cachée avec As/10 (« peek ») et reste sur
   * soft 17. Remplit et retourne l'objet r :
   *   out : 'win' | 'loss' | 'push' | 'bj' | 'surrender'
   *   net : gain en unités, wager : mise totale engagée (2 si doublé), up : index carte croupier
   */
  function simRound(shoe, o, r) {
    if (shoe.needsShuffle()) shoe.reshuffle();
    const p = [shoe.draw()];
    const up = shoe.draw();
    p.push(shoe.draw());
    const hole = shoe.draw();

    r.up = upIndex(up); r.net = 0; r.wager = 1; r.out = 'push';
    r.bust = false; r.dbl = false;

    const dealerBJ = cardVal(up) >= 10 && evaluate([up, hole]).total === 21;
    const playerBJ = evaluate(p).total === 21;
    if (dealerBJ) {
      if (!playerBJ) { r.out = 'loss'; r.net = -1; }
      return r;
    }
    if (playerBJ) { r.out = 'bj'; r.net = 1.5; return r; }

    let bet = 1;
    for (;;) {
      if (evaluate(p).total > 21) { r.bust = true; r.out = 'loss'; r.net = -bet; return r; }
      const d = decide(p, up, { surrender: o.surrender });
      if (d.action === 'S') break;
      if (d.action === 'R') { r.out = 'surrender'; r.net = -0.5; return r; }
      p.push(shoe.draw());
      if (d.action === 'D') {
        bet = 2; r.wager = 2; r.dbl = true;
        if (evaluate(p).total > 21) { r.bust = true; r.out = 'loss'; r.net = -2; return r; }
        break;
      }
    }

    const dealer = [up, hole];
    for (;;) {
      const e = evaluate(dealer);
      if (e.total >= 17) break; // S17 : reste aussi sur soft 17
      dealer.push(shoe.draw());
    }
    const pt = evaluate(p).total, dt = evaluate(dealer).total;
    if (dt > 21 || pt > dt) { r.out = 'win'; r.net = bet; }
    else if (pt < dt) { r.out = 'loss'; r.net = -bet; }
    else { r.out = 'push'; r.net = 0; }
    return r;
  }

  BJ.engine = { Shoe, simRound };
})(typeof window !== 'undefined' ? window : globalThis);
