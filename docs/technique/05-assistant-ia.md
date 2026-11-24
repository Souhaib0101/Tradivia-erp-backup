# 05 — Assistant IA, historique, outils et suivi public

[Retour au sommaire](../../DOCUMENTATION_TECHNIQUE.md) · [Configuration](06-exploitation.md)

L'assistant est un client de modèle intégré à l'API, avec un catalogue d'outils métier. Le navigateur envoie une demande à Tradivia ; il ne contacte pas directement le fournisseur IA. Le modèle peut proposer un outil ; c'est Node qui valide et exécute ses opérations. Le modèle ne dispose pas d'un outil d'exécution SQL libre ou d'accès arbitraire au disque.

## Deux interfaces dans `App.jsx`

| Composant | Fonctions |
| --- | --- |
| `AgentChat` | Chat flottant, chargement de la configuration à la première ouverture, reprise de la conversation la plus récente, nouvelle conversation, messages, état d'attente, erreurs et bouton d'agrandissement. |
| `AgentWorkspace` | Espace Assistant IA dans le menu, liste des conversations, dates formatées, ouverture d'une conversation, nouveau fil, suggestions, zone de saisie, défilement et téléchargement. Entrée envoie ; Maj+Entrée garde un saut de ligne. |

Le texte entré apparaît immédiatement dans l'interface. La réponse arrive en JSON à la fin de l'appel, sans streaming de jetons. Un succès peut contenir `artifacts`: le client en fait des boutons, puis récupère le fichier par `authFetch` vers l'API protégée. L'historique relu ne contient que le texte des anciens échanges ; les boutons d'export n'y sont pas reconstruits. Les deux vues partagent les mêmes routes et la base, mais conservent des états React distincts. Après un succès, elles demandent un rafraîchissement des données métier.

## Les fonctions de `apps/api/agent/agent.cjs`

| Bloc | Rôle précis |
| --- | --- |
| `WRITE_TOOLS`, `looksLikeConfirmation` | Répertorie les mutations internes et reconnaît une affirmation en début de message selon des expressions régulières. |
| `tool`, `buildTools` | Déclare les fonctions au format compatible Chat Completions : nom, description, paramètres avec types/champs requis, champs optionnels acceptant souvent `null`. |
| `CORE_TOOL_NAMES`, `TOOL_GROUPS`, `selectTools` | En mode compact, part d'un ensemble de base puis ajoute les domaines détectés par mots-clés dans la demande et les six dernières lignes d'historique. Les appels d'outils récents aident à retenir le domaine lorsque l'utilisateur répond simplement pour confirmer. Le mode compact réduit la taille de la requête ; ce n'est pas une permission serveur. |
| `cleanText`, `cleanNumber`, `cleanId`, `isoDateOrToday`, `currentYear`, `limitOf`, `parseArgs` | Nettoie les entrées et contrôle longueurs, types, dates et bornes. Date par défaut côté outil calculée avec le fuseau `Africa/Casablanca`. Les listes avec limite utilisent généralement 20 entrées par défaut et au plus 50. |
| `findClient`, `nextInvoiceNumber`, `totalTtcOf` | Sélectionne un client par ID ou par nom exact normalisé, signale l'ambiguïté ; génère `FAC-AAAA-NNNN` si le numéro est absent, en partant de la séquence existante ; restitue le TTC avec ajustement. |
| `buildAccountingSummary`, `buildVatSummary`, `buildTaxSummary` | Agrégats destinés à la réponse IA ; s'appuient sur SQLite et partagent les fonctions de calcul transmises par le serveur lorsque pertinent. Les objets retournés ne sont pas forcément identiques aux réponses du dashboard HTTP. |
| `executeTool` | Dispatcher des opérations : requêtes SQLite préparées, contrôle des arguments, réutilisation des fonctions métier ou appel de `web.cjs`. Les exports retournent la référence d'un téléchargement, pas le fichier lui-même. |
| `readAgentConfig`, `providerHost`, `callModel` | Lit l'environnement, détecte si le fournisseur est configuré, prépare la requête et gère les erreurs/délais du fournisseur. |
| `buildSystemPrompt` | Ajoute date/heure marocaine, compte et rôle, fiche société, nombres de lignes métier et consignes de fonctionnement, de confidentialité et de confirmation. |
| `toLlmMessage`, `sanitizeHistory` | Reconstitue les rôles attendus par le modèle ; écarte les appels d'outils incomplets ou orphelins afin de ne pas envoyer une séquence incohérente. |
| `mountAgentRoutes` | Crée les tables/indexes et déclare les routes sur l'instance Express. Les fonctions internes enregistrent les messages et les actions, contrôlent le propriétaire, chargent l'historique et exécutent la boucle de chat. |

### Catalogue métier

| Outils | Ce qu'ils font |
| --- | --- |
| `get_company`, `list_clients`, `get_client` | Fiche société, recherche client par nom/ICE/CIN/contact et lecture d'une fiche par ID. |
| `list_invoices`, `get_invoice` | Recherche et lecture des factures, filtres année/mois/client/état payé, TTC ajusté et client associé. |
| `list_containers`, `get_container` | Recherche par numéro/scellé/fournisseur/BL et statut ; nombre ou métadonnées des pièces jointes, selon la lecture. |
| `list_charges`, `list_tva_transfers`, `list_beneficiary_transfers` | Consultation des charges filtrables et listes des deux familles de virements. |
| `accounting_summary`, `vat_summary`, `tax_summary`, `detect_anomalies` | Vue annuelle, TVA annuelle ou trimestrielle, estimations fiscales et anomalies déterministes. |
| `create_client`, `update_client` | Création/édition de client ; contrôle du type, des champs et du CIN selon le parcours. |
| `create_invoice`, `update_invoice`, `mark_invoice_paid` | Création avec un client existant et recomposition des montants ; édition avec conservation des champs omis ; mise à jour dédiée du drapeau de règlement. |
| `create_container`, `update_container` | Création et mise à jour de la fiche logistique, sans téléversement. |
| `create_charge`, `create_tva_transfer`, `create_beneficiary_transfer` | Écritures métier correspondantes. L'agent ne crée pas un paiement bancaire réel. |
| `export_invoice`, `export_tva_transfer`, `export_beneficiary_transfer` | Vérifie la ressource et prépare un lien protégé par JWT pour téléchargement PDF ou DOCX. |
| `web_search`, `web_fetch`, `web_browse`, `track_container` | Recherche, lecture statique, lecture d'un site public avec rendu JavaScript et suivi Maersk. |

Les mutations n'empruntent pas les routes CRUD via une requête HTTP intermédiaire ; elles ont leur propre validation dans `executeTool`. Ainsi le CIN est exigé pour une création physique par l'outil, tandis que la création client HTTP tolère un CIN manquant. Le catalogue n'expose pas de suppression métier, de clôture, de gestion des utilisateurs, de modification de la société ni d'upload de fichiers.

## Boucle d'un message et confirmation

1. `POST /api/agent/chat` exige un message non vide de 8 000 caractères au plus. La route contrôle le propriétaire de la conversation ou la crée, titre le premier message si nécessaire, puis sauvegarde l'entrée utilisateur.
2. `runAgent` contrôle l'activation et la configuration, recharge jusqu'à 60 lignes récentes, retire les séquences d'outils incomplètes, compose le contexte et choisit les outils exposés. `callModel` envoie `messages`, `tools`, `tool_choice: auto`, température `0.2` et `max_tokens` à `/chat/completions`. La clé, si configurée, est transmise côté serveur. L'appel a un délai de 90 s ; HTTP 429 peut être retenté deux fois, avec attente limitée.
3. Si le modèle retourne des `tool_calls`, les appels sont identifiés et sauvegardés. Pour une mutation interne, le serveur exige simultanément un message utilisateur reconnu comme affirmation et `confirm: true` dans l'appel, sauf configuration qui désactive cette exigence. Un refus produit `CONFIRMATION_REQUIRED` sans déclencher la mutation. L'assistant doit d'abord présenter l'action envisagée et attendre la réponse.
4. Chaque résultat est journalisé (`ok`, `error`, `confirmation_required`), lié à l'appel d'outil dans l'historique, puis transmis au modèle. Les paramètres et résultats du journal sont limités à 8 000 caractères chacun ; le résultat transmis comme message d'outil est tronqué à 6 000 caractères en mode compact ou 16 000 en mode complet.
5. La boucle continue au plus le nombre de tours configuré (8 par défaut) jusqu'à un message de réponse final. À défaut de réponse, un texte de repli est sauvegardé. Les liens d'export sont dédupliqués par URL. Le nombre de tours n'est pas le nombre exact d'appels d'outils, puisqu'un tour peut en proposer plusieurs.

La protection actuelle repose sur le texte du dernier message et sur l'argument `confirm`. Le code ne mémorise pas une autorisation liée à une opération immuable et à ses paramètres ; cette liaison est une amélioration à prévoir si les écritures IA deviennent critiques. Il n'y a pas non plus d'annulation automatique d'une écriture déjà faite si un appel au modèle échoue ensuite.

## Routes et stockage

Toutes les routes utilisent le JWT monté par `server.cjs`.

| Route | Contrat |
| --- | --- |
| `GET /api/agent/config` | `enabled`, `configured`, modèle, hôte du fournisseur, recherche web, type de fournisseur de recherche, disponibilité détectée du navigateur et politique de confirmation. Ne renvoie pas la clé IA. |
| `GET /api/agent/conversations` | Dernières conversations du compte, jusqu'à 50, avec `message_count`. |
| `POST /api/agent/conversations` | Crée un fil ; titre optionnel de 120 caractères au maximum. Sans titre, utilise « Nouvelle conversation ». |
| `GET /api/agent/conversations/:id/messages` | `{conversation, messages}`. Ne renvoie que les textes non vides des rôles `user`/`assistant`, avec ID et date. Une conversation d'un autre compte est traitée comme introuvable. |
| `DELETE /api/agent/conversations/:id` | Supprime le fil du compte et ses messages par cascade. Cette route de gestion d'historique n'est pas un outil IA et n'efface pas le journal technique. |
| `POST /api/agent/chat` | `{conversation_id, message}` ; ID facultatif pour créer un fil. Retour `{conversation_id, conversation_title, reply, artifacts, steps, model}`. |

La base contient `agent_conversations`, `agent_messages` et `agent_action_log`. Les messages peuvent conserver texte utilisateur, texte assistant, appels d'outils, résultats et métadonnées du fournisseur. Selon la demande, le modèle externe reçoit du contexte et des données métier retournées par les outils, potentiellement des données clients ou bancaires. Pour un usage sur des données réelles, décider quelles catégories peuvent être transmises, fixer des règles de conservation et restreindre le journal ; supprimer un fil seul ne purge pas tous les événements associés.

## `apps/api/agent/web.cjs` — services web publics

| Fonctions | Responsabilité |
| --- | --- |
| `assertPublicUrl`, `isPrivateIPv4`, `isPrivateIPv6` | Contrôles des destinations publiques, protocole HTTP/HTTPS, résolution DNS et refus de plages/adresses privées connues sur l'URL validée. |
| `decodeEntities`, `htmlToText`, `extractTitle`, `readLimitedText` | Décodage d'entités HTML, retrait des balises et éléments parasites, extraction du titre, contrôle de taille. |
| `webFetch` | Lit une page statique avec `fetch`, vérifie les destinations de redirection, limite le nombre de redirections et la réponse, renvoie URL, titre, type et texte. N'exécute pas les scripts du site. |
| `tavilySearch`, `duckDuckGoSearch`, `unwrapDuckDuckGo`, `webSearch` | Recherche jusqu'à 10 résultats ; essaie Tavily si une clé est présente, sinon utilise le HTML public de DuckDuckGo. Si Tavily échoue ou ne renvoie rien, bascule sur DuckDuckGo. |
| `findBrowserExecutable`, `openBrowserContext`, `webBrowse` | Détection de Chrome/Edge ou chemin explicite, navigateur piloté par Playwright dans un nouveau contexte, lecture du texte réellement rendu. Offre des interactions limitées de formulaire et referme le navigateur en fin d'appel. |
| `trackContainer` | Lit la page de suivi Maersk à partir d'un numéro de conteneur ou de BL et récupère les informations de suivi rendues disponibles par ce site. Renvoie leurs statuts et du texte, sans modifier la fiche locale. Seul Maersk est implémenté et la dépendance au site public peut évoluer. |

Les extraits web doivent être traités comme des données externes à vérifier. Pour une installation exposée, limiter les sorties réseau aux domaines approuvés (proxy ou politique réseau), isoler le navigateur et éviter les interactions externes déclenchées automatiquement. Les vérifications locales du code ne remplacent pas cette isolation. En cas de refus d'accès d'un site transporteur, utiliser son API officielle.
