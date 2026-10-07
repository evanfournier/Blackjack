# Blackjack Trainer

Site statique (HTML/CSS/JS, aucune dépendance) basé sur `strategie_blackjack.pdf`.
Ouvre simplement `index.html` dans un navigateur, ou publie le dépôt avec GitHub Pages.

- **Simulation** : joue N mains automatiquement en suivant exactement le guide (stats, EV, avantage maison, courbe de bankroll, résultat par carte du croupier).
- **Mode capital** (simulation) : capital de départ, objectif de profit, arrêt à la ruine, et plusieurs sessions pour estimer la probabilité d’atteindre l’objectif avant la ruine.
- **Entraînement** : joue contre le croupier ; chaque décision est corrigée avec la case du guide, et tes statistiques sont sauvegardées (localStorage).
- **Tableau** : les tableaux du guide, plus les paires converties en totaux.

## Règles
6 ou 8 jeux, croupier reste sur soft 17, blackjack 3:2, le croupier regarde sa carte cachée avec As/10,
double sur les 2 premières cartes, abandon (optionnel), jamais d'assurance, **split interdit**.
Sans split, une paire se joue comme son total ; A-A est un « souple 12 » (absent du guide) : on tire toujours.

## Tests
`node tests/test.js` : vérifie les cases du guide et mesure l'avantage maison sur 2 M de mains.
