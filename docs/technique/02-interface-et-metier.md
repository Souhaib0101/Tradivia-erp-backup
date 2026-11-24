# 02 — Interface React et fonctionnalités métier

[Retour au sommaire](../../DOCUMENTATION_TECHNIQUE.md) · [Contrats HTTP](03-api-et-donnees.md)

## Structure du frontend

L'implémentation tient dans le [`App.jsx` de la racine](../../App.jsx). C'est une application monopage : un état React `page` contrôle l'écran affiché, sans React Router ni une URL par écran. `Dashboard` ouvre Factures par défaut ; un rechargement remonte l'application et revient à cet état initial. Les hooks `useState`, `useEffect`, `useRef` et `useLayoutEffect` couvrent l'authentification, les données, les effets réseau, le focus et les références DOM. Il n'y a pas de magasin Redux ni de bibliothèque de graphiques.

| Bloc de `App.jsx` | Responsabilité |
| --- | --- |
| Imports et `createFontIcon` | CSS Bootstrap Icons et polices variables Inter/JetBrains Mono ; de petits composants React convertissent un nom d'icône en classe CSS. L'application n'utilise pas les composants JavaScript de Bootstrap. |
| `API`, `setAuthToken`, `setOnUnauthorized`, `authFetch`, `apiJson` | Normalise la base HTTP en retirant le slash de fin. Ajoute l'en-tête Bearer aux requêtes protégées ; traite les `401` de session. `apiJson` unifie le décodage JSON et la remontée des erreurs. |
| `downloadBlob` | Crée une URL d'objet et un lien temporaire avec attribut `download`, déclenche le téléchargement et libère la ressource. |
| `STYLE` | CSS injecté via `<style>` : variables de couleur, thème, grille, barre latérale, cartes, tableaux, badges, modales, formulaires, chat et mises en page adaptées aux écrans étroits. Le seul autre CSS applicatif est le reset `global.css`. |
| `fmt`, `fmtDate`, `fmtInt`, `fmtFileSize` | Affichage local des nombres et dates (`fr-MA` pour les dates), tailles B/KB/MB/GB et quantités affichées en nombres entiers. L'affichage formaté n'est pas la valeur stockée. |
| Constantes métier | Options de statut/type de conteneur, catégories de charges, moyens de paiement et libellés d'anomalies. Ce sont des menus de saisie et des libellés, pas nécessairement des énumérations strictes côté API. |
| `ThemeToggle`, `getBadgeClass`, `FileKindIcon` | Commutateur clair/sombre ; classe du badge selon le statut ; choix d'icône d'un fichier à partir de son MIME. |
| `numToWords`, `calcTotals`, `buildInvoiceVars`, `exportInvoice` | Aperçu et export unitaire historiques côté navigateur. Le serveur calcule les montants enregistrés ; les autres parcours d'export utilisent son propre formateur. |
| `LoginScreen` | Formulaire de connexion contrôlé, erreur et attente réseau. |
| `AgentChat`, `AgentWorkspace` | Chat flottant et écran assistant pleine page, décrits dans le [chapitre IA](05-assistant-ia.md). |
| `Dashboard` | États métier, menu, chargement, filtres, calculs d'affichage, actions et rendu des pages/modales. |
| `App` (export par défaut) | Thème global, session, sélection entre attente, connexion et dashboard. |

### Session, thème et cycle de chargement

1. `App` initialise le thème avec `tradivia_theme` dans `localStorage`, sinon avec `prefers-color-scheme`. Le thème est appliqué à `document.documentElement.dataset.theme` et à `colorScheme`, puis sauvegardé.
2. Le jeton et la fiche utilisateur sont relus via `tradivia_token` et `tradivia_user`. `GET /api/auth/me` contrôle la validité de la session. Un échec supprime l'état local. Quand il n'y a pas de session, ce code tente la connexion du compte initial, et ne présente le formulaire que si la tentative échoue. C'est le comportement actuel, y compris après une déconnexion si les identifiants initiaux fonctionnent encore.
3. `LoginScreen.handleSubmit` poste l'identifiant et le mot de passe. Une réussite enregistre jeton et utilisateur ; une erreur reste dans le formulaire et réactive son bouton.
4. `Dashboard.reloadData` lance en parallèle les lectures des clients, factures, conteneurs, charges, catégories, exercices, virements TVA et virements bénéficiaires. `loadCompany` est séparé. `loadAnomalies` est déclenché après le chargement puis lors de changements dans les listes qui alimentent l'analyse.
5. Les mutations HTTP remplacent, ajoutent ou retirent des lignes dans l'état React. Un toast notifie succès/erreur ; la suppression destructive passe habituellement par `window.confirm`. Le chat déclenche un rechargement général après une réponse réussie.

Le dashboard conserve un `form`, un `editTarget`, un `expandedId` et un `showModal` communs à plusieurs écrans. `openNew*` choisit les valeurs proposées et efface la cible ; `openEdit*` copie une ligne. Le formulaire appelle `POST` à la création et `PUT` à l'édition. Les flèches natives des champs numériques sont masquées par CSS ; un écouteur de molette quitte un champ numérique actif pour éviter les changements involontaires pendant le défilement.

## Factures

### Liste, filtres et actions

- La liste dépend de `/api/factures`, enrichie pour l'affichage par les clients déjà chargés. Les filtres sont **locaux** : texte (numéro, nom du client, désignation), année, mois, client et état payé/impayé. Les compteurs HT/TTC et le nombre d'impayées suivent les lignes visibles.
- L'année est déduite des dates présentes. Le filtre client distingue sociétés, personnes physiques et éventuelles anciennes factures physiques non rattachées. Les détails d'une ligne s'ouvrent via `expandedId`.
- `selectedFactureIds` est un `Set`. Tout sélectionner concerne la liste filtrée. Au changement de filtre, les identifiants qui ne sont plus visibles sont retirés. Les exports ont deux portées : **sélection visible** ou **toutes les lignes filtrées** ; la suppression groupée porte sur la sélection visible.
- Le paiement correspond à `paid` (`0`/`1`), pas à un encaissement bancaire ni à une table de paiements. `togglePaid` renvoie la facture entière par `PUT`. Le serveur recalcule donc également les montants. La création HTTP initialise toujours `paid` à `0`.
- `doExport` lance un téléchargement PDF ou DOCX par ligne. `exportGroup` transmet les identifiants au serveur pour relecture SQLite et fusion. Voir [les trois chemins d'export](04-documents.md).

### Formulaire et calculs

L'écran propose Casablanca, une désignation de café vert et la date du jour à la création. L'utilisateur saisit le numéro, choisit une société ou une personne physique, sélectionne sa fiche, indique la date/désignation, le mode de calcul et éventuellement le moyen de paiement. Dans l'interface manuelle le numéro est saisi ; l'outil IA sait en produire un. L'API exige que l'identifiant sélectionné corresponde au type demandé.

`round2(x)` arrondit à deux décimales. La TVA incluse à 20 % du HT correspond à `TTC × 20 / 120 = TTC / 6`.

| Mode | Saisie | Règles serveur |
| --- | --- | --- |
| Quantité (`qte`) | `qte_kg` et `pu_ttc` positifs | `pt_ttc = round2(qte_kg × pu_ttc)` ; `tva = round2(pt_ttc / 6)` ; `montant_ht = round2(pt_ttc − tva)` ; pas d'ajustement, `total_ttc_saisi = null`. |
| Total imposé (`total`) | `total_ttc_saisi` et `pu_ttc` positifs | `qte_kg = floor(total / pu_ttc)` ; `pt_ttc = round2(qte_kg × pu_ttc)` ; `ajustement_arrondi = round2(total − pt_ttc)` ; TVA et HT calculés sur le total imposé. |

Exemples : `100 kg × 12 DH = 1 200 DH TTC`, dont `200 DH` de TVA et `1 000 DH HT`. Avec `1 000 DH TTC` imposés à `48 DH/kg`, le résultat est `20 kg`, `960 DH` de ligne et `40 DH` d'ajustement, soit `166,67 DH` de TVA et `833,33 DH HT`. Le total utilisé en comptabilité et dans la liste est `pt_ttc + ajustement_arrondi`. En mode total, si le montant est inférieur au prix unitaire, la formule peut produire zéro kilogramme : le serveur valide les montants de départ, sans minimum calculé de 1 kg.

L'aperçu `calcTotals` répond immédiatement aux changements de champ, mais emploie `parseFloat` et n'arrondit pas exactement les mêmes entrées que le serveur. La ligne renvoyée par l'API est la référence sauvegardée. Pour une personne physique, le serveur copie nom, CIN et adresse dans la facture ; pour une société, le rendu repose sur la fiche liée. Une édition de facture physique reprend les données courantes du client.

## Clients

- Deux types de fiches : `societe` avec ICE, ou `physique` avec CIN ; nom, adresse, téléphone et e-mail sont les champs communs. Le formulaire adapte l'identifiant affiché au type choisi.
- `saveClient` crée ou modifie, `deleteClient` demande confirmation. La réponse du serveur est appliquée à l'état local. La liste API est triée par nom ; après une création, l'interface ajoute localement la ligne sans refaire automatiquement ce tri.
- Une facture référence la fiche par `clientId` ; le serveur refuse la suppression de cette fiche et refuse aussi son changement de type si elle est déjà utilisée. Le CIN non vide d'une personne physique est unique en ignorant casse et espaces de bord, par index SQLite. Le module d'anomalies signale les formats inhabituels, ce qui n'implique pas un blocage systématique à la saisie.

## Conteneurs et pièces jointes

- Données : numéro unique, type, scellé, fournisseur, ports, dates de départ/arrivée, nombre de sacs, poids total, poids commandé/reçu, BL (connaissement) et référence de facture commerciale. Les statuts proposés sont En transit, Arrivé, Dédouanement, Livré et En attente ; le statut est saisi manuellement dans cet écran.
- Le frontend construit les paramètres `q`, `statut`, `fournisseur`, `port_depart` et `port_arrivee` avec `URLSearchParams`. Un délai de 300 ms entre la saisie et la lecture évite une requête serveur à chaque frappe immédiate. Le serveur recherche notamment sur numéro, scellé, fournisseur et BL.
- Le formulaire propose `40ft` et `En transit` à la création. L'API valide les dates et leur ordre, les poids non négatifs et un nombre de sacs entier non négatif. Le poids commandé et le poids reçu alimentent les anomalies.
- Dans la fiche développée, le sélecteur de fichiers ou le glisser-déposer envoie du multipart. Un état par conteneur indique qu'un transfert est en cours ; `fetch` ne fournit pas ici de suivi réel octet par octet de la progression. Le téléchargement, l'aperçu dans un nouvel onglet et la suppression utilisent des requêtes authentifiées. Voir [le stockage](04-documents.md).
- Le suivi Maersk est une consultation de l'assistant. Il ne synchronise pas automatiquement les statuts du registre local et ne remplace pas la validation de la fiche par l'utilisateur.

## Charges

Le formulaire saisit date, catégorie, libellé, HT, TVA, TTC, fournisseur, paiement, référence, case Déductible et notes. `handleChargeChange` recalcule le TTC lorsque HT ou TVA change. Avec un TTC transmis, l'API vérifie l'écart avec `HT + TVA` arrondi (tolérance d'un centime). La case est cochée par défaut dans le formulaire. Côté API, un booléen false ou omis est converti en `0` lors de la création HTTP.

La liste peut être filtrée par année, catégorie ou texte (libellé, fournisseur, référence), avec délai de 300 ms. Les catégories du filtre proviennent de SQLite ; les options du formulaire viennent de la liste définie dans `App.jsx`. Cette liste est distincte des options d'année de l'écran, actuellement figées sur 2025 et 2026 en plus de « Toutes années ». L'API de statistiques existe indépendamment de la table de l'écran Charges. Dans la comptabilité, seules les charges marquées déductibles diminuent le résultat brut estimé et contribuent à la TVA déductible.

## Ordres de virement

| Écran | Données et traitement |
| --- | --- |
| Ordre virement TVA (`virement_tva`) | Date, montant positif, référence, notes ; création/édition/suppression et exports. Le modèle utilise seulement la date et le montant. |
| Ordre de virement bénéficiaire (`virement_zizi`) | Date, bénéficiaire, RIB/IBAN, montant positif, référence et notes. Le formulaire exige également une banque et l'envoie, mais l'API ne la lit pas : elle disparaît à la réponse/relecture et n'entre pas dans le modèle. |

L'API bénéficiaire exige un nom et un RIB/IBAN non vides et impose des limites de longueur ; le calcul d'anomalies contrôle séparément le format. Un export relit la fiche et remplit son modèle. Ces écrans conservent et impriment des ordres ; ils ne déclenchent aucun transfert, et les ordres TVA ne sont pas déduits automatiquement de la TVA estimée.

## Comptabilité et exercices

| Onglet | Éléments affichés / chargés |
| --- | --- |
| Tableau de bord | Chiffre d'affaires, charges, résultat, marge, impôts estimés, créances, TVA, séries mensuelles, top 5 clients et répartition des charges. Les visualisations sont rendues dans le JSX et le CSS. |
| TVA | Année + trimestre facultatif ; TVA des ventes, TVA des charges déductibles, TVA à payer ou crédit et détails mensuels. |
| Exercices | Liste des clôtures et action de clôture sur l'année choisie, après confirmation. Le tableau de bord et la liste sont ensuite rechargés. |

Les agrégats reposent sur la date de facturation ou de charge ; le chiffre d'affaires comprend les factures payées et impayées, tandis que les créances utilisent `paid = 0`. Résultat brut = `CA HT − charges HT déductibles`. TVA à payer = `max(TVA collectée − TVA déductible, 0)` ; crédit = `max(TVA déductible − TVA collectée, 0)`. Marge : résultat brut divisé par le CA HT, en pourcentage lorsque le CA est positif. Les montants affichés en DH sont des estimations selon les règles codées :

| Indicateur | Règle dans `fiscalEstimate` et le dashboard |
| --- | --- |
| IS calculé | `max(résultat brut × taux, 0)` ; 20 % en dessous de 100 M DH, 35 % à partir de 100 M DH. |
| Cotisation minimale | `max(CA HT × 0,25 %, 3 000 DH)` si CA HT positif, zéro sinon. IS dû : le plus grand de l'IS calculé et de la cotisation minimale ; les deux ne s'additionnent pas. |
| CSS | 0 % sous 1 M DH ; 1,5 % de 1 à moins de 5 M ; 2,5 % de 5 à moins de 10 M ; 3,5 % de 10 à moins de 40 M ; 5 % à partir de 40 M. Le taux est appliqué au résultat positif. |
| Résultat net du dashboard | `résultat brut − IS dû − CSS`. La patente estimée (`CA HT × 0,5 %`) est séparée et n'est pas retranchée de ce net. |
| Acomptes d'IS | Le point d'API Impôts (pas d'onglet distinct) estime quatre échéances trimestrielles avec `IS dû / 4`, arrondi au dirham pour le retour. |

Le sélecteur Comptabilité propose 2024–2026 en dur, bien que l'état initial utilise l'année courante et que l'API accepte un intervalle plus large. Le graphique mensuel part des mois avec chiffre d'affaires : un mois avec des charges mais sans facture ne reçoit pas de barre. La répartition actuelle rapporte le HT de chaque catégorie (toutes charges) au HT déductible ; les proportions peuvent ne pas totaliser 100 % lorsque des charges ne sont pas déductibles. Le top clients classe le TTC ajusté des factures rattachées à un client.

La clôture enregistre un instantané annuel sous le statut `Cloture`. Une nouvelle clôture pour la même année remplace les indicateurs existants. Le mot « irréversible » dans le dialogue ne signifie pas blocage des factures, des charges ni de cette route ; aucun workflow de réouverture/configuration du calendrier fiscal n'est implémenté. Ces chiffres sont ceux du logiciel et ne constituent pas une validation des déclarations fiscales.

## Anomalies

L'interface affiche des compteurs, une liste filtrable par sévérité, un bouton d'actualisation et un raccourci vers la page métier signalée. Le serveur recalculant tout à la demande, il ne stocke pas d'alerte à acquitter ; un avertissement peut disparaître après correction des données. Le badge du menu est plafonné visuellement à `99+`.

| Contrôle serveur | Déclenchement |
| --- | --- |
| Doublon de facture (`duplicate_invoice`) | Critique : même client, même date et même TTC ajusté arrondi, même si les numéros sont uniques. |
| Prix unitaire atypique (`price_outlier`) | Avertissement : au moins trois factures de même désignation normalisée ; PU TTC hors intervalle `[55 %, 145 %]` de leur médiane positive. |
| TVA incohérente (`vat_mismatch`) | Critique : différence de plus de deux centimes entre la TVA de facture et `round2(TTC ajusté / 6)`. |
| Écart de poids (`weight_mismatch`) | Si poids commandé et reçu sont positifs : avertissement au-delà de 1 % ; critique au-delà de 5 %, écart ramené au poids commandé. |
| Identité (`suspicious_identity`) | Avertissement pour les identifiants non vides au format inhabituel : ICE différent de 15 chiffres ; CIN hors 1–3 lettres suivies de 4–10 chiffres après normalisation. |
| Compte bénéficiaire (`suspicious_bank_account`) | Critique si le champ non vide n'est ni un RIB marocain de 24 chiffres ni un IBAN de format accepté et de reste modulo 97 égal à 1. Pour le RIB, il s'agit d'un contrôle de forme. |
| Charge atypique (`unusual_charge`) | Avertissement : au moins trois charges de même catégorie normalisée et TTC hors intervalle `[25 %, 250 %]` de leur médiane positive. |

Le rapport fournit `generated_at`, `summary` (`total`, `critical`, `warning`, `by_type`) et `anomalies`. Chaque signalement contient type, sévérité, titre, message, entité, page d'action et détails. L'identifiant de signalement est une séquence générée à chaque calcul, pas un identifiant persistant.

## Société et gestion des comptes

L'écran Société récupère les champs `name`, `ice`, `rc`, `cnss`, `patente`, `if_number`, `address`, `phone`, `email`. Tout compte connecté peut consulter ; seul `admin` peut modifier. L'écran prépare un brouillon (`companyDraft`), gère la sauvegarde et affiche la réponse ; l'API valide les longueurs, le nom non vide, l'e-mail si renseigné et l'ICE à 15 chiffres si renseigné. Les coordonnées intégrées par le concepteur des templates Word ne sont pas recalculées depuis cette fiche.

Les fonctions de changement de mot de passe, de création et de désactivation d'utilisateur sont proposées par l'API. Le menu actif ne contient ni page de gestion des utilisateurs ni écran de changement de mot de passe. La barre latérale affiche l'identifiant, le rôle et le bouton Déconnexion.
