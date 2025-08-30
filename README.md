# Simulateur de Tarification Ramify

Application web client-side pour simuler et comparer différents modèles de tarification d'articles.

## Fonctionnalités

- **Import CSV** : Glissez-déposez ou sélectionnez un fichier CSV contenant les données des articles
- **5 Modèles de tarification** :
  - Par Mot (PW)
  - Prix Fixe (FP)
  - Hybride (HY)
  - Taux Marginal Décroissant (DMR)
  - Cap + Dépassement (C+O)
- **Configuration personnalisée** : Paramètres globaux et par rédacteur
- **Bonus Qualité** : Modifier les tarifs avec un pourcentage de bonus
- **Analyses statistiques** : CV, percentiles, moyennes
- **Visualisations** : Graphiques d'évolution et comparaisons
- **Tableau de bord** : Métriques clés et comparaisons Baseline vs Simulation

## Format CSV requis

Le fichier CSV doit contenir les colonnes suivantes :
- `URL` : URL de l'article
- `Writer` : Nom du rédacteur
- `Publish Date` : Date de publication (format DD/MM/YYYY)
- `Word Count` : Nombre de mots

## Installation

1. Clonez le repository
2. Ouvrez `index.html` dans votre navigateur
3. L'application fonctionne entièrement côté client, aucun serveur requis

## Déploiement

L'application peut être déployée comme site statique sur GitHub Pages, Netlify, Vercel, etc.

## Technologies utilisées

- HTML5/CSS3/JavaScript (Vanilla)
- PapaParse (parsing CSV)
- Chart.js (visualisations)
- Simple Statistics (calculs statistiques)
- Date-fns (gestion des dates)