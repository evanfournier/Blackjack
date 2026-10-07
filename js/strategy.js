/* Stratégie de base — transcrite EXACTEMENT du guide strategie_blackjack.pdf.
 * Règles du guide : 6-8 jeux, croupier reste sur soft 17 (S17), blackjack 3:2,
 * double autorisé, abandon autorisé, jamais d'assurance.
 * Variante demandée : SPLIT INTERDIT. Une paire se joue donc comme son total
 * (dur ou souple) avec les tableaux « mains dures » / « mains souples ».
 */
(function (g) {
  'use strict';
  const BJ = (g.BJ = g.BJ || {});

  const UPS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const row = (label, s) => ({ label, cells: s.split(' ') });

  // Colonnes = carte visible du croupier : 2 3 4 5 6 7 8 9 10 A
  const HARD_ROWS = [
    row('5 – 8',   'H H H H H H H H H H'),
    row('9',       'H D D D D H H H H H'),
    row('10',      'D D D D D D D D H H'),
    row('11',      'D D D D D D D D D H'),
    row('12',      'H H S S S H H H H H'),
    row('13 – 14', 'S S S S S H H H H H'),
    row('15',      'S S S S S H H H R H'),
    row('16',      'S S S S S H H R R R'),
    row('17 +',    'S S S S S S S S S S'),
  ];

  const SOFT_ROWS = [
    row('A-2 / A-3', 'H H H D D H H H H H'),
    row('A-4 / A-5', 'H H D D D H H H H H'),
    row('A-6',       'H D D D D H H H H H'),
    row('A-7',       'S Ds Ds Ds Ds S S H H H'),
    row('A-8 / A-9', 'S S S S S S S S S S'),
  ];

  // A-A (souple 12) : absent du guide car il y est séparé. Sans split on tire toujours.
  const SOFT12_ROW = row('A-A (souple 12)', 'H H H H H H H H H H');

  const ACTION_NAMES = { H: 'Tirer', S: 'Rester', D: 'Doubler', R: 'Abandonner' };

  const cardVal = (r) => (r === 1 ? 11 : Math.min(r, 10));
  const upIndex = (r) => (r === 1 ? 9 : Math.min(r, 10) - 2);

  function evaluate(ranks) {
    let sum = 0, aces = 0;
    for (let i = 0; i < ranks.length; i++) {
      const r = ranks[i];
      if (r === 1) { aces++; sum += 1; } else sum += r >= 10 ? 10 : r;
    }
    let soft = false;
    if (aces > 0 && sum + 10 <= 21) { sum += 10; soft = true; }
    return { total: sum, soft };
  }

  function hardRow(t) {
    if (t <= 8) return 0;
    if (t <= 11) return t - 8;      // 9→1, 10→2, 11→3
    if (t === 12) return 4;
    if (t <= 14) return 5;
    if (t === 15) return 6;
    if (t === 16) return 7;
    return 8;
  }

  function softRow(t) {
    if (t <= 14) return SOFT_ROWS[0];
    if (t <= 16) return SOFT_ROWS[1];
    if (t === 17) return SOFT_ROWS[2];
    if (t === 18) return SOFT_ROWS[3];
    return SOFT_ROWS[4];
  }

  /* Meilleure décision selon le guide.
   * ranks : rangs des cartes du joueur (1=As … 13=Roi), upRank : carte visible du croupier.
   * opts.surrender : l'abandon est-il autorisé à la table ?
   * Double et abandon ne sont possibles que sur les deux premières cartes :
   *   D → « si interdit : tirer », Ds → « si interdit : rester », R → « si interdit : tirer ».
   */
  function decide(ranks, upRank, opts) {
    opts = opts || {};
    const { total, soft } = evaluate(ranks);
    const first = ranks.length === 2;
    const canDouble = first;
    const canSurrender = first && !!opts.surrender;
    const isPair = first && Math.min(ranks[0], 10) === Math.min(ranks[1], 10);

    let table, rowObj;
    if (total >= 21) { table = 'dure'; rowObj = HARD_ROWS[8]; }
    else if (soft) {
      table = 'souple';
      rowObj = total === 12 ? SOFT12_ROW : softRow(total);
    } else { table = 'dure'; rowObj = HARD_ROWS[hardRow(total)]; }

    const raw = rowObj.cells[upIndex(upRank)];
    let action;
    switch (raw) {
      case 'D':  action = canDouble ? 'D' : 'H'; break;
      case 'Ds': action = canDouble ? 'D' : 'S'; break;
      case 'R':  action = canSurrender ? 'R' : 'H'; break;
      default:   action = raw;
    }
    return {
      action, raw, total, soft, isPair, canDouble, canSurrender,
      table, rowLabel: rowObj.label,
      handName: (soft ? 'Souple ' : 'Dur ') + total,
    };
  }

  BJ.strategy = {
    UPS, HARD_ROWS, SOFT_ROWS, SOFT12_ROW, ACTION_NAMES,
    cardVal, upIndex, evaluate, decide,
  };
})(typeof window !== 'undefined' ? window : globalThis);
