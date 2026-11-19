# Registre des naissances — React + .NET 10 + EF Core + SQL Server

Exemple complet en **Clean Architecture**, avec l'accent sur le **frontend React**.

```
naissances/
├── backend/                         (.NET 10 — Visual Studio / Rider)
│   ├── Naissances.slnx
│   ├── sql/schema.sql               ← lisible dans SSMS
│   ├── sql/identite.sql             ← tables des comptes (Identity), après schema.sql
│   ├── src/
│   │   ├── Naissances.Domain/         Entité Naissance, objets valeur, règles métier (0 dépendance)
│   │   ├── Naissances.Application/    Cas d'utilisation, interfaces, DTO (dépend du Domaine)
│   │   ├── Naissances.Infrastructure/ EF Core + SQL Server (implémente les interfaces)
│   │   └── Naissances.Api/            Minimal API, ProblemDetails, composition root
│   └── tests/Naissances.Domain.Tests/ xUnit
└── frontend/                        (React 19 + Vite + TypeScript — VS Code)
    └── src/
        ├── api/                       client fetch + types du contrat
        ├── components/                Champ accessible, ChampMotDePasse (œil), ErrorBoundary, Layout, Pagination
        ├── hooks/                     useDebouncedValue
        ├── features/auth/             session, garde de route, connexion, changement de mot de passe
        ├── features/naissances/       schéma Zod, hooks TanStack Query, formulaire, pages, tests
        └── test/                      MSW (faux serveur), setup Vitest
```

## Démarrage

```bash
# 1) Backend (SQL Server local, voir appsettings.json)
cd backend
dotnet tool install --global dotnet-ef        # une seule fois
# Les migrations (Initiale, Identite) sont déjà dans src/Naissances.Infrastructure/Migrations.

# Premier compte (une seule fois) — stocké hors du dépôt grâce à user-secrets :
dotnet user-secrets set "CompteInitial:Courriel"   "vous@exemple.ca"     --project src/Naissances.Api
dotnet user-secrets set "CompteInitial:MotDePasse" "Un-MotDePasse-Fort1" --project src/Naissances.Api

dotnet run --project src/Naissances.Api        # http://localhost:5080 (applique les migrations + crée le compte en dev)
dotnet test

# 2) Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxy /api → :5080, donc pas de CORS)
npm test           # 35 tests Vitest + Testing Library + MSW
```

Connectez-vous sur http://localhost:5173 avec le compte initial, puis changez le mot de passe
via **Mot de passe** dans l'en-tête.

> Si `dotnet build` échoue avec « fichier verrouillé par Naissances.Api », l'API tourne encore :
> arrêtez-la (Ctrl+C) ou générez en Release (`dotnet ef ... --configuration Release`).

> Réseau CGI/Zscaler : si `npm install` ou `dotnet restore` échoue en SSL, même correctif
> que pour les labs (certificat racine Zscaler). Ne jamais committer le .crt.

---

## Clean Architecture en une image

```
  React ──HTTP/JSON──▶ Api ──▶ Application ──▶ Domain
                        │           ▲
                        └──▶ Infrastructure (EF Core, SQL Server)
```

* Les dépendances pointent **vers le Domaine**. Le Domaine ne connaît ni EF Core ni ASP.NET.
* `Naissance.Enregistrer(...)` est la **seule** façon de créer une naissance valide (constructeur privé).
* L'Application définit `INaissanceRepository`, l'Infrastructure l'implémente (inversion de dépendance).
* Lecture et écriture séparées (CQRS léger) : `ILectureNaissances` projette directement en DTO, `AsNoTracking`.
* Concurrence optimiste : colonne `rowversion` → **409** si deux agents modifient la même fiche.
* Erreurs : `DomainException("…", champ: "poidsGrammes")` → **422 ProblemDetails** avec `errors.poidsGrammes`.

---

## Authentification (connexion, mot de passe)

**Backend** — ASP.NET Core Identity + cookie ([Authentification.cs](backend/src/Naissances.Api/Authentification.cs),
[AuthEndpoints.cs](backend/src/Naissances.Api/Endpoints/AuthEndpoints.cs)) :

| Route | Résultat |
|---|---|
| `POST /api/auth/connexion` `{ courriel, motDePasse }` | 200 + cookie, ou 401 |
| `POST /api/auth/deconnexion` | 204 |
| `GET /api/auth/moi` | 200 `{ courriel }` ou 401 |
| `POST /api/auth/mot-de-passe` `{ motDePasseActuel, nouveauMotDePasse }` | 204, ou 422 avec `errors.motDePasseActuel` / `errors.nouveauMotDePasse` |

* Toutes les routes `/api/naissances` exigent d'être connecté (`RequireAuthorization` → **401**).
* Mots de passe **hachés** (PBKDF2) dans `etatcivil.AspNetUsers`, jamais en clair.
* Règles : 10 caractères minimum, majuscule, minuscule, chiffre, caractère spécial (messages en français).
* **Verrouillage** 5 minutes après 5 échecs ; message identique pour « courriel inconnu » et
  « mauvais mot de passe » (on ne révèle pas quels comptes existent).
* Cookie `HttpOnly` (illisible en JavaScript) + `SameSite=Strict` (protection CSRF), `Secure` hors dev,
  8 h glissantes. Une API ne redirige pas vers une page de login : elle répond 401 / 403.
* Pas d'inscription publique : le premier compte vient de la configuration `CompteInitial:*`
  (user-secrets en dev). La création n'a lieu que si le compte n'existe pas encore.

**Frontend** :

* La session est un état serveur → `useSession()` (TanStack Query, `null` = non connecté).
* `RouteProtegee` enveloppe le `Layout` : non connecté → `/connexion`, puis retour à la page demandée.
* Un **401 n'importe où** (session expirée) remet la session à `null` via `QueryCache`/`MutationCache`
  → redirection automatique vers la connexion.
* `ChampMotDePasse` : bouton **œil** (`type="button"`, `aria-pressed`) qui bascule `password` ↔ `text`.
* Page **Mot de passe** : ancien + nouveau + confirmation (Zod reprend les règles du serveur,
  confirmation identique, nouveau ≠ actuel) ; un 422 s'affiche sous le bon champ.
* La déconnexion vide le cache : l'agent suivant ne voit pas les données du précédent.

---

## Le frontend React — les choix expliqués

### 1. Séparation des responsabilités

| Couche | Fichier | Rôle |
|---|---|---|
| Transport | `api/client.ts` | `fetch`, JSON, `AbortSignal`, ProblemDetails → `ApiError` typée |
| Contrat | `api/naissances.ts` | Types miroirs des DTO C# + fonctions d'appel |
| État serveur | `features/naissances/hooks.ts` | TanStack Query : cache, clés, invalidation, optimiste |
| Validation | `features/naissances/schema.ts` | Zod : mêmes règles que le domaine, pour l'UX |
| UI | `components/`, `pages/` | Rendu, accessibilité, navigation |

La page `NouvelleNaissancePage` est un **conteneur** (mutation + navigation) ; `NaissanceForm`
ne connaît ni TanStack Query ni le routeur → testable isolément avec un simple `vi.fn()`.

### 2. État serveur ≠ état client

* **Serveur** (liste, détail) → TanStack Query. Pas de `useEffect` + `useState` pour fetcher :
  le cache gère chargement, erreurs, annulation, déduplication et rafraîchissement.
* **URL** (recherche, statut, page) → `useSearchParams`. Lien partageable, F5 et bouton Précédent fonctionnent.
* **Local** (saisie en cours, panneau ouvert) → `useState`.
* **Formulaire** → React Hook Form (inputs non contrôlés : pas de re-render à chaque frappe).

### 3. TanStack Query — points avancés utilisés

* **Fabrique de clés** `naissancesKeys` : hiérarchique → `invalidateQueries({ queryKey: listes() })`.
* **`queryOptions`** : options réutilisables (useQuery, prefetch, loaders).
* **`signal`** passé à `fetch` : si l'utilisateur tape vite, les requêtes obsolètes sont **annulées**.
* **`placeholderData: keepPreviousData`** : changer de page n'affiche pas un tableau vide ;
  `isPlaceholderData` grise le tableau et désactive la pagination.
* **Retry intelligent** : jamais sur un 4xx (inutile), 2 fois max sur 5xx.
* **Mise à jour optimiste** (annulation) : `onMutate` (snapshot + écriture cache) → `onError` (rollback) →
  `onSettled` (resynchronisation, nouvelle rowversion).

### 4. Formulaire : RHF + Zod

* `useForm<Input, unknown, Output>` : types d'entrée/sortie distincts (Zod 4).
* `valueAsNumber` : les nombres arrivent en `number` ; vide → `NaN` → message « obligatoire ».
* `superRefine` pour les règles **inter-champs** (âge du parent par rapport à la date de l'enfant,
  second parent requis seulement si la case est cochée), avec `path` pour viser le bon input.
* `useWatch({ name: 'avecSecondParent' })` : seul ce champ re-rend la section conditionnelle.
* **Erreurs serveur** : un 422 est traduit en `setError('poidsGrammes', …)` → message sous le champ.
  Le front valide pour l'UX, **le serveur reste la source de vérité**.

### 5. Recherche avec debounce + URL

`saisie` (local, réactif) → `useDebouncedValue` (300 ms) → `setSearchParams(..., { replace: true })`.
Si l'URL change de l'extérieur (Précédent), la saisie est resynchronisée par le pattern
« ajuster l'état pendant le rendu » plutôt qu'un `useEffect` supplémentaire.

### 6. Robustesse et performance

* `ErrorBoundary` (classe — toujours nécessaire en React 19) + `QueryErrorResetBoundary` :
  « Réessayer » relance aussi les requêtes ; reset automatique au changement de route (`resetKey`).
* `lazy()` + `Suspense` : la page de création (Zod + RHF) est un chunk séparé (~40 kB gzip).
* `key={n.id}` (jamais l'index) dans les listes.
* `StrictMode` en dev pour détecter les effets impurs.

### 7. Accessibilité

* `Champ` : `useId` relie label ↔ input, `aria-invalid`, `aria-describedby` vers aide et erreur.
* Focus automatique sur un champ en erreur à la soumission.
* `aria-live` pour le compteur de résultats, la pagination et le résumé d'erreurs ;
  `role="alert"` / `role="status"` pour les messages.
* Lien d'évitement « Aller au contenu », `<fieldset>/<legend>` pour les groupes, `<search>`, `<dl>`.

### 8. Tests (Vitest + Testing Library + MSW)

* **MSW** simule le serveur au niveau réseau : les composants utilisent le vrai `client.ts`.
* On cible par **rôle et libellé accessible** (`getByLabelText`, `getByRole`) comme un utilisateur.
* Couverts : règles Zod, erreurs sous les champs, mapping d'un 422, recherche debounce → URL,
  lecture des filtres depuis l'URL, 404, 500 + Réessayer, annulation optimiste, rollback sur 409,
  création → redirection + message flash.
* Authentification : redirection vers `/connexion` puis retour, identifiants invalides, œil
  afficher/masquer, déconnexion, 401 → reconnexion, changement de mot de passe (succès, 422, confirmation),
  règles Zod du nouveau mot de passe.
* Note Vitest 5 : `setup.ts` étend aussi le `expect` **global** avec jest-dom (sinon
  « Invalid Chai property: toBeInTheDocument »).

---

## Pistes d'évolution

* Générer les types TypeScript depuis `/openapi/v1.json` (openapi-typescript / orval) pour ne plus
  maintenir `api/naissances.ts` à la main.
* Rôles (agent / superviseur) et écran d'administration des comptes ; à terme, Entra ID + MSAL React.
* Mot de passe oublié (lien par courriel), authentification à deux facteurs.
* Tests d'intégration API avec `WebApplicationFactory` + Testcontainers SQL Server.
* Pipeline Azure DevOps / GitLab : `dotnet test`, `npm test`, `npm run build`, image Docker, déploiement.
