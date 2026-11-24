# Tradivia System

Monorepo de gestion commerciale : factures, clients, conteneurs, charges, comptabilité et exports DOCX/PDF.

Documentation technique du site : [DOCUMENTATION_TECHNIQUE.md](./DOCUMENTATION_TECHNIQUE.md). L'ancienne référence est conservée dans [SYSTEM_DOCUMENTATION.md](./SYSTEM_DOCUMENTATION.md).

Cette copie contient le code et les ressources de Tradivia. La configuration privée, les bases locales et les pièces jointes d'exploitation restent hors Git. Au premier démarrage, l'API crée une nouvelle base SQLite si aucune base n'est présente. Pour retrouver des données existantes, restaurez séparément une sauvegarde de la base et de ses pièces jointes.

## Prérequis

- Node.js 22 ou plus récent (requis par `better-sqlite3` ; vérifié avec Node.js 24) ;
- Python 3 avec les dépendances de `workers/documents/requirements.txt` ;
- Microsoft Word sous Windows pour la conversion PDF, ou LibreOffice (`soffice`) sous Linux.

Sous Windows, si npm ne trouve pas de binaire `better-sqlite3` précompilé, installez la charge de travail **Développement Desktop en C++** de Visual Studio ou Visual Studio Build Tools pour permettre sa compilation.

Sous Windows, lancez l'API depuis une session utilisateur interactive (`npm run dev:api`) afin que Microsoft Word puisse exporter les PDF. Le worker essaie automatiquement LibreOffice comme solution de secours lorsqu'il est installé.

Le projet détecte automatiquement `.python/python.exe` et `.venv/Scripts/python.exe` sous Windows. Pour préparer un environnement local :

```powershell
py -3 -m venv .python
.\.python\Scripts\python.exe -m pip install -r workers\documents\requirements.txt
```

## Démarrage

Dans deux terminaux ouverts à la racine :

```powershell
npm install
npm run dev:api
```

```powershell
npm run dev:web
```

- Interface : http://localhost:5173
- API : http://localhost:3001
- Santé API : http://localhost:3001/health

Au premier démarrage, le compte local est `admin`. Le mot de passe temporaire par défaut est `ChangeMe123!` et doit être changé. En production, configurez obligatoirement `JWT_SECRET` et `ADMIN_DEFAULT_PASSWORD` dans `.env`.

Pour personnaliser les chemins, CORS ou l’URL API du frontend, copiez `.env.example` vers `.env` et adaptez les valeurs.

## Assistant IA (chatbox)

Une chatbox est disponible en bas à droite de l’interface. Elle exécute les tâches via des outils internes (clients, factures, conteneurs, charges, virements, comptabilité, exports) et peut consulter le web. Le bouton d’agrandissement ouvre l’espace **Assistant IA** dans le menu latéral, avec historique des conversations, liste des messages et zone de saisie plein écran.

1. Copiez `.env.example` vers `.env`.
2. Renseignez `AGENT_API_KEY`, `AGENT_BASE_URL` et `AGENT_MODEL` pour un fournisseur compatible OpenAI (OpenAI, OpenRouter, DeepSeek, Groq, Ollama…).
3. Redémarrez l’API, puis ouvrez la chatbox.

Exemple avec Groq (gratuit) :

```env
AGENT_BASE_URL=https://api.groq.com/openai/v1
AGENT_MODEL=openai/gpt-oss-20b
AGENT_COMPACT_TOOLS=true
AGENT_MAX_TOKENS=1024
```

Exemple avec Ollama local :

```env
AGENT_BASE_URL=http://localhost:11434/v1
AGENT_MODEL=qwen2.5:7b
```

Les actions qui modifient le système (création de facture, client, conteneur, charge, virement) demandent une confirmation explicite. L’agent ne supprime aucune donnée.

Le plan gratuit Groq est limité à 8 000 jetons/minute. `AGENT_COMPACT_TOOLS=true` n’envoie que les outils pertinents et l’agent réessaie automatiquement après une erreur 429.

### Accès web et navigation

- `web_search` : recherche des pages et extraits.
- `web_fetch` : lit le HTML statique d’une page publique.
- `web_browse` : ouvre la page dans Chrome ou Edge, exécute le JavaScript, attend le chargement, peut remplir un champ et cliquer, puis renvoie le texte visible. Chrome/Edge est détecté automatiquement ; sinon définissez `CHROME_PATH`.
- `track_container` : suit un conteneur ou un BL Maersk et récupère les données de tracking affichées par le site.

Le suivi Maersk dépend de l’API publique utilisée par le site et peut évoluer. Pour un usage de production, utilisez l’API officielle Maersk avec vos identifiants.

Certains sites de transporteurs (Cloudflare, CAPTCHA, authentification) bloquent la navigation automatique. Dans ce cas, utilisez l’API officielle du transporteur plutôt que de contourner la protection.

## Vérifications

```powershell
npm test
npm run build -w @tradivia/web
.\.python\python.exe -m unittest discover -s workers/documents -p "test*.py" -v
```

Les tests d’intégration des exports Word/PDF peuvent être activés avec `TEST_DOCUMENT_EXPORTS=1` et `TEST_PDF_EXPORTS=1`.

Les seuls workers documentaires canoniques sont dans `workers/documents`; les scripts et modèles historiques conservés à la racine ne doivent pas être utilisés.
