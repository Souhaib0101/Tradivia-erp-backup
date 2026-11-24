# 01 — Cartographie fichier par fichier

[Retour au sommaire](../../DOCUMENTATION_TECHNIQUE.md)

Les chemins sont relatifs à la racine de Tradivia. **Actif** signifie chargé dans le parcours npm normal ; **historique** signifie conservé dans le dépôt, mais non appelé par ce parcours ; **généré** désigne un résultat d'installation, de build, d'exécution ou de test.

## Arborescence utile

```text
Tradivia/
├─ App.jsx                         # Implémentation active de l'interface
├─ .env / .env.example             # Configuration locale / exemple
├─ .gitignore / package*.json      # Règles Git et monorepo npm
├─ apps/
│  ├─ api/
│  │  ├─ server.cjs               # API, règles métier et schéma actif
│  │  ├─ package.json
│  │  ├─ agent/                   # Assistant IA et services web
│  │  ├─ tradivia.db              # Base par défaut
│  │  ├─ uploads/containers/      # Binaires par ID de conteneur
│  │  ├─ data/                    # Base du prototype
│  │  ├─ src/                     # Ancienne structure modulaire + adaptateur
│  │  └─ tests/{unit,integration}/
│  └─ web/
│     ├─ package.json / index.html / vite.config.js
│     ├─ src/{app,components,pages,services,styles}/
│     └─ dist/                    # Build généré
├─ workers/documents/
│  ├─ fill_template.py / merge_invoices.py
│  ├─ requirements.txt / test_documents.py
│  └─ templates/                  # Quatre modèles DOCX
├─ infra/                         # Configuration Compose non déployable
├─ scripts/                       # Utilitaire de démo, hors runtime
└─ docs/technique/                # Documentation technique, non servie par l'API
```

## Racine : exécution et configuration

| Fichier | Fonction et technologies |
| --- | --- |
| `App.jsx` | Source active de l'interface : React, CSS intégré, icônes, authentification, dashboard métier, fenêtres modales et deux présentations du chat. Le point d'entrée Vite l'atteint par un réexport. Voir [le découpage interne](02-interface-et-metier.md). |
| `package.json` | Monorepo npm privé, workspaces `apps/*`, exigence déclarée `node >=20`, commandes racine `dev:api`, `dev:web` et `test` déléguées aux workspaces. |
| `package-lock.json` | Verrou de résolution npm : dépendances directes et transitives, versions et informations d'intégrité. À synchroniser avec `package.json` après changement de dépendance. |
| `.env.example` | Exemple de paramètres, sans clé IA réelle. Documente le port, SQLite, le JWT, CORS, les uploads, les documents et l'assistant. |
| `.env` | Configuration effective locale : Express la charge depuis la racine avec `dotenv`, Vite y lit les variables publiques `VITE_*`. Les valeurs privées n'ont pas été reproduites. |
| `.gitignore` | Ignore notamment les dépendances, `.env`, les uploads, `dist`, les caches Python, les logs et les fichiers auxiliaires SQLite. N'annule pas le suivi de fichiers déjà suivis : `apps/api/tradivia.db`, les journaux présents et `.chrome-test/` figurent dans les chemins Git observés. La règle `data/*.db` ne remplace pas une règle explicite pour la base active `apps/api/tradivia.db`. |
| `README.md` | Guide rapide de démarrage, prérequis et configuration de l'assistant ; pas un fichier exécuté. |
| `SYSTEM_DOCUMENTATION.md` | Ancienne documentation en anglais : utile comme historique mais certains chemins et comportements ont changé, principalement le point d'implémentation React et l'assistant. |

## `apps/web/` — frontend livré au navigateur

| Chemin | Statut | Rôle |
| --- | --- | --- |
| `apps/web/` | Actif | Workspace `@tradivia/web`, hôte Vite et source du bundle statique. |
| `apps/web/package.json` | Actif | `vite` en développement, `vite build` en production. React/React DOM 18, Vite 6, plugin React, Bootstrap Icons et polices Fontsource. |
| `apps/web/index.html` | Actif | Contient le nœud `<div id="root">` et charge `/src/main.jsx` comme module. Ce fichier ne contient pas les écrans. |
| `apps/web/vite.config.js` | Actif | Plugin React, `envDir: "../.."`, serveur `0.0.0.0:5173`, aperçu `0.0.0.0:4173`, port strict. Aucun proxy API configuré. |
| `apps/web/src/` | Actif | Arborescence des points d'entrée et des fichiers du prototype. |
| `apps/web/src/main.jsx` | Actif | Importe React, `createRoot`, le composant `App` et le CSS global, puis rend l'application dans `#root`. |
| `apps/web/src/app/App.jsx` | Actif | Une seule instruction de réexport : `export { default as App } from '../../../../App.jsx';`. Modifier le `App.jsx` racine pour changer le rendu, pas cet adaptateur. |
| `apps/web/src/styles/global.css` | Actif | Reset neutre : `box-sizing: border-box`, largeur et hauteur minimale pour `html`, `body`, `#root`, marges retirées. La mise en page métier reste dans le CSS de `App.jsx`. |
| `apps/web/src/components/Sidebar.jsx` | Historique | Ancienne barre latérale textuelle, sans navigation métier active ; importée par `DashboardPage.jsx` seulement. |
| `apps/web/src/pages/DashboardPage.jsx` | Historique | Ancienne page statique qui affiche la barre latérale du prototype et un titre ; non importée par `main.jsx`. |
| `apps/web/src/services/api.js` | Historique | Wrapper générique `fetch(base + path, options)`. Le vrai client HTTP est dans `App.jsx`, avec gestion du JWT et des erreurs. |
| `apps/web/dist/index.html` | Généré | Point d'entrée de production ; il référence les fichiers compilés par Vite. |
| `apps/web/dist/assets/` | Généré | `index-*.js` (bundle React), `index-*.css` (CSS importé), `bootstrap-icons-*.woff/.woff2` (icônes), `inter-*-wght-normal-*.woff2` et `jetbrains-mono-*-wght-normal-*.woff2` (polices, réparties en sous-ensembles de caractères). Les suffixes sont liés au build. |
| `apps/web/node_modules/.vite/` | Généré | Cache Vite de précompilation des dépendances pour le développement. Ne pas modifier comme du code source. |

## `apps/api/` — backend actif et stockage local

| Chemin | Rôle |
| --- | --- |
| `apps/api/` | Workspace `@tradivia/api`. Les chemins relatifs du serveur actif pour SQLite, les uploads et les workers sont résolus par rapport à ce dossier. |
| `apps/api/package.json` | Entrée `server.cjs` ; `dev` active `node --watch`, `start` exécute Node, `lint` vérifie la syntaxe avec `node --check`, `test` utilise `node --test`. Le package interprète les `.js` en ES modules ; les `.cjs` restent CommonJS. |
| `apps/api/server.cjs` | Instancie Express et SQLite, initialise les tables, valide les opérations métier, signe les JWT, gère les uploads et orchestre les exports. Le [chapitre API](03-api-et-donnees.md) en détaille les sections. |
| `apps/api/agent/agent.cjs` | Protocole de chat et d'outils, requêtes métier, liaison au modèle, historique, validation des écritures et journal. |
| `apps/api/agent/web.cjs` | Recherche, lecture HTML, lecture par navigateur, suivi Maersk et contrôles des destinations publiques. Voir [l'assistant](05-assistant-ia.md). |
| `apps/api/tradivia.db` | Fichier SQLite actif par défaut : données métier, utilisateurs, paramètres et conversations. L'inspection documentaire repose sur le schéma du code et les tests, pas sur une publication des lignes de cette base. |
| `apps/api/tradivia.db-wal` | Journal SQLite WAL : peut contenir des changements validés non encore recopiés dans le fichier principal. |
| `apps/api/tradivia.db-shm` | Mémoire partagée auxiliaire de SQLite pour la coordination du WAL. Le moteur gère les deux fichiers. |
| `apps/api/uploads/` | Parent des pièces jointes, configurable par `UPLOAD_DIR`. Créé par le serveur s'il manque. |
| `apps/api/uploads/containers/` | Sous-dossiers par identifiant de conteneur ; les fichiers ont un nom interne. Les noms originaux et métadonnées sont conservés dans SQLite. |
| `apps/api/data/tradivia.db` | Base distincte du prototype, correspondant au défaut de `src/config/env.js`, pas au défaut de `server.cjs`. Ne pas choisir cette base en pensant utiliser la base active. |

### Dépendances directes de l'API

| Dépendance | Usage |
| --- | --- |
| `express` 4 | Routage HTTP, JSON, middlewares et réponses binaires. |
| `better-sqlite3` 13 | Liaison native SQLite ; requêtes préparées et transactions synchrones. |
| `cors` 2 | Contrôle des origines des appels HTTP du frontend. |
| `dotenv` 16 | Chargement de la configuration côté Node. |
| `bcryptjs` 2 | Hachage et vérification des mots de passe. |
| `jsonwebtoken` 9 | Création et vérification des jetons Bearer. |
| `multer` 2 | Lecture du multipart et stockage sur disque des fichiers reçus. |
| `playwright-core` | Pilotage d'un Chrome/Edge installé ; ce package ne fournit pas à lui seul le navigateur utilisé par l'agent. |
| `zod` 3 | Validation déclarative de l'ancien code modulaire ; les routes actives emploient surtout leurs propres validateurs. |
| Modules de Node | `path`, `fs`, `os` pour les chemins, fichiers et répertoires temporaires ; `child_process.execFileSync` pour Python ; `fetch`, `AbortController`, DNS/réseau pour les intégrations. |

### `apps/api/src/` — inventaire du prototype

Les manifests npm ne démarrent pas ce dossier. Particularité : `bootstrap/app.js` n'assemble plus les anciens routeurs ; il renvoie l'application de `server.cjs`. Les fichiers `modules/` et `shared/` sont donc de l'ancien code, même si un point d'entrée adaptateur subsiste.

| Chemin dans `apps/api/src/` | Responsabilité |
| --- | --- |
| `bootstrap/` | Couche de démarrage conservée. |
| `bootstrap/app.js` | Pont ESM → CommonJS via `createRequire` ; `createApp()` renvoie l'instance Express exportée par `server.cjs`. |
| `bootstrap/server.js` | Lance l'instance renvoyée par `createApp()` avec le port de `config/env.js`. Point d'entrée alternatif non invoqué par npm. |
| `config/env.js` | Ancienne couche de lecture de l'environnement via `dotenv/config` ; défauts port, base `./data/tradivia.db`, clé de développement, origine et chemin des documents. |
| `database/connection.js` | Ouvre la base de l'ancien schéma avec `better-sqlite3`, crée le parent et active ses clés étrangères. |
| `database/migrate.js` | Lit les SQL du dossier `migrations/` par nom, applique les migrations absentes et les enregistre dans `schema_migrations`. Non utilisé par le démarrage actif. |
| `database/migrations/001_initial.sql` | Tables de l'ancien schéma `users`, `clients`, `invoices`, `containers`, `expenses`. Des champs tels que `type`, `number`, `reference` et `expense_date` ne correspondent pas aux noms actifs. |
| `modules/auth/auth.routes.js` | Ancien routeur login et profil (`/me`). |
| `modules/auth/auth.controller.js` | Transmet la requête au service de login et renvoie le résultat ; renvoie le profil via `req.user`. |
| `modules/auth/auth.service.js` | Vérifie le mot de passe avec bcrypt et signe un JWT de 8 h avec `sub` et `role` ; contrat différent du serveur actif. |
| `modules/auth/auth.repository.js` | Sélectionne un utilisateur actif par nom dans la base du prototype. |
| `modules/clients/client.routes.js` | Ancien CRUD avec Zod et champ `type`, au lieu de `client_type`. |
| `modules/containers/container.routes.js` | Ancien CRUD autour de `reference`, `supplier`, `status`, `eta`, `notes`, sans pièces jointes dans ce routeur. |
| `modules/expenses/expense.routes.js` | Ancien CRUD des dépenses ; lien optionnel vers un conteneur et jointure pour afficher sa référence. Ce lien n'existe pas dans la table active `charges`. |
| `modules/invoices/invoice.routes.js` | Ancien routeur de liste et création, sans l'ensemble du CRUD actuel. |
| `modules/invoices/invoice.controller.js` | Applique le schéma de création et appelle le service ; renvoie `201` à la création dans le prototype. |
| `modules/invoices/invoice.schema.js` | Zod : numéro, désignation, quantité/prix positifs et identifiant client entier optionnel. |
| `modules/invoices/invoice.service.js` | Calcule HT/TVA/TTC à partir de la quantité, insère dans `invoices`, et liste avec jointure client. L'actif utilise `factures` et deux modes de calcul. |
| `modules/accounting/accounting.routes.js` | Ancien résumé `/summary` : agrégats factures/dépenses, nombres de clients et de conteneurs, et écart recettes HT − dépenses. |
| `modules/documents/document.service.js` | Ancien appel `execFile` asynchrone à Python. Passe les variables JSON comme argument ; le worker actuel attend le chemin d'un fichier JSON et l'API active utilise sa propre orchestration. |
| `shared/errors/AppError.js` | Classe d'erreur avec un statut HTTP. |
| `shared/middleware/authenticate.js` | Vérification JWT et autorisation par rôle du prototype. |
| `shared/middleware/errors.js` | Anciennes réponses JSON 404 et traitement générique des erreurs. |

Le dossier `modules/` était découpé par domaine ; `shared/` mutualisait erreurs et middlewares ; `config/` et `database/` fournissaient la configuration et le stockage. Cette organisation reste une référence historique, pas le répertoire où intervenir pour corriger les routes actuelles.

## Workers, tests et infrastructure

| Chemin | Rôle |
| --- | --- |
| `workers/` | Regroupe les programmes appelés par l'API. Le projet ne contient pas de service worker PWA ni de file de tâches documentaire séparée. |
| `workers/documents/fill_template.py` | Remplit un DOCX par substitution de balises, vérifie les variables manquantes et convertit en PDF sur demande. |
| `workers/documents/merge_invoices.py` | Produit des DOCX unitaires, fusionne le corps XML des factures et peut convertir le DOCX final. |
| `workers/documents/requirements.txt` | `python-docx==1.1.2` ; `pywin32>=308` pour CPython sous Windows. |
| `workers/documents/test_documents.py` | Tests `unittest` des quatre modèles, du formatage Word préservé, de la détection de variable manquante et de la fusion de deux factures. |
| `workers/documents/templates/template_Tradivia_ajust.docx` | Modèle principal de facture, distingue total de ligne, ajustement et total final. |
| `workers/documents/templates/template_tradivia.docx` | Modèle de secours historique avec variables client imbriquées. |
| `workers/documents/templates/template_ordre_virement_TVA.docx` | Modèle d'ordre TVA, date et montant. |
| `workers/documents/templates/template_Ordre_de_virement_zizi.docx` | Modèle d'ordre bénéficiaire, nom, RIB, date et montant en chiffres et en lettres. |
| `apps/api/tests/unit/server.helpers.test.cjs` | Vérifie les calculs, les variables de modèle, les montants en lettres, la fiscalité et les anomalies. |
| `apps/api/tests/unit/invoice.service.test.js` | Assertion de base sur `1200 / 6 = 200` ; malgré son nom, n'importe pas `invoice.service.js`. |
| `apps/api/tests/unit/agent.helpers.test.cjs` | Vérifie le catalogue d'outils, le mode compact, la reconnaissance des affirmations et des contrôles web élémentaires. |
| `apps/api/tests/integration/system.integration.test.cjs` | Parcours HTTP complet avec base et uploads temporaires. DOCX et PDF sont des branches d'intégration optionnelles. |
| `apps/api/tests/integration/agent.integration.test.cjs` | Test HTTP avec modèle simulé, lecture et validation du refus puis de l'exécution d'une écriture confirmée. |
| `infra/docker-compose.yml` | `services: {}` : aucun conteneur à démarrer. |
| `infra/README.md` | Explique l'absence de déploiement Docker supporté et les prérequis d'une future mise en conteneur. |

## Doubles de la racine et fichiers générés

| Chemin | Statut / explication |
| --- | --- |
| `index.js` | Ancien serveur monolithique Express/SQLite, avec domaines métier et anciens chemins de fichiers ; n'est pas le point d'entrée npm. |
| `fill_template.py` | Ancien remplisseur Word de la racine avec conversion PDF ; distinct du worker actif et de son contrôle des balises non résolues. |
| `fill_template_old.py` | Ancienne version élémentaire : remplit les paragraphes et cellules du DOCX sans le pipeline PDF actif. |
| `merge_invoices.py` | Ancienne fusion de factures ; l'API active pointe vers la copie de `workers/documents/`. |
| `template_Tradivia_ajust.docx` | Copie racine du modèle principal, identique octet par octet lors de l'analyse. |
| `template_tradivia.docx` | Copie racine du modèle de secours, identique lors de l'analyse. |
| `template_ordre_virement_TVA.docx` | Copie racine du modèle TVA, identique lors de l'analyse. |
| `template_Ordre_de_virement_zizi.docx` | Ancienne copie racine du modèle bénéficiaire ; **différente** du modèle utilisé dans `workers/documents/templates/`. Elle contient notamment la balise `banque`, absente du modèle actif. |
| `scripts/seed-screenshots.cjs` | Utilitaire de préparation de données fictives pour des captures. Il importe le serveur actif, sauvegarde la base dans `output/backups/`, puis insère en transaction clients, factures et charges mensuelles, ainsi que des conteneurs. Des repères de démo permettent de retrouver ou ignorer des exemples déjà présents. Il journalise les comptages et les contrôles SQLite d'intégrité et de clés étrangères. Aucune commande npm normale ne l'appelle. À traiter comme un script d'écriture sur la base configurée, pas comme une lecture. |
| `api.log`, `api-error.log`, `web.log`, `web-error.log` | Fichiers de sortie locaux associés aux lancements API/web ; aucun module du site n'en dépend. |
| `node_modules/` et `node_modules/.bin/` | Dépendances et exécutables CLI installés par npm. Leur inventaire de versions est le lockfile ; le code tiers n'est pas du code Tradivia. |
| `.git/` | Historique et métadonnées Git, hors application. |
| `.chrome-test/`, `frontend-login.png` | Profil et capture de tests navigateur, pas des ressources du site. |
| `__pycache__/`, `~$*.docx` | Cache bytecode Python et fichiers de verrou Word temporaires. Ils ne sont pas les modèles à modifier. |

Les fichiers `Rapport.tex`, `rapport_tradivia.tex`, `docs/Rapport.tex`, `docs/images/`, `docs/diagrams/`, `steps.md` et les sorties de présentation dans `output/` sont hors périmètre fonctionnel. Les anciens `docs/architecture.md` et `docs/source-layout.md` peuvent aider à lire l'historique mais ne déterminent pas les imports actuels.
