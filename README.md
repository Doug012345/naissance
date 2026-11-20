# Registre des naissances — React + .NET 10 + EF Core + SQL Server

Exemple complet en **Clean Architecture**, avec l'accent sur le **frontend React**.

```
naissances/
├── azure-pipelines.yml              CI/CD Azure DevOps (voir « CI/CD »)
├── pipelines/                       modèle d'installation Terraform + script plan/apply du pipeline
├── infra/                           Terraform : tout l'hébergement Azure (voir « Déploiement Azure »)
├── docker-compose.yml               SQL Server + API + site, en une commande
├── .env.example                     modèle des secrets locaux (copier en .env)
├── backend/                         (.NET 10 — Visual Studio / Rider)
│   ├── Dockerfile                   image de l'API (SDK → runtime, non-root, port 8080)
│   ├── Naissances.slnx
│   ├── sql/schema.sql               ← lisible dans SSMS
│   ├── sql/identite.sql             ← tables des comptes (Identity), après schema.sql
│   ├── src/
│   │   ├── Naissances.Domain/         Entité Naissance, objets valeur, règles métier (0 dépendance)
│   │   ├── Naissances.Application/    Cas d'utilisation, interfaces, DTO (dépend du Domaine)
│   │   ├── Naissances.Infrastructure/ EF Core + SQL Server, certificat PDF (QuestPDF + QRCoder)
│   │   └── Naissances.Api/            Minimal API, ProblemDetails, composition root
│   └── tests/Naissances.Domain.Tests/ xUnit
└── frontend/                        (React 19 + Vite + TypeScript — VS Code)
    ├── Dockerfile                   image du site (Node → nginx non-root, port 8080)
    ├── nginx.conf.template          sert le site + relaie /api vers l'API
    └── src/
        ├── api/                       client fetch + types du contrat
        ├── components/                Champ accessible, ChampMotDePasse (œil), ErrorBoundary, Layout, Pagination
        ├── hooks/                     useDebouncedValue
        ├── features/auth/             session, garde de route, connexion, changement de mot de passe
        ├── features/naissances/       schéma Zod, hooks TanStack Query, formulaire, pages (dont rectification), tests
        ├── features/certificat/       certificat imprimable / PDF (sceau, QR code), page publique /verifier
        └── test/                      MSW (faux serveur), setup Vitest
```

## Démarrage

```bash
# 1) Backend (SQL Server local, voir appsettings.json)
cd backend
dotnet tool install --global dotnet-ef        # une seule fois
# Les migrations (Initiale, Identite, ClesProtection, CertificatVerification, RectificationNaissance) sont déjà dans
# src/Naissances.Infrastructure/Migrations.
# ⚠️ appsettings.json pointe vers la base Azure (db-naissances) : « dotnet run » et
#    « dotnet ef database update » appliquent les migrations EN PRODUCTION.

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

## Démarrage avec Docker (tout-en-un)

Prérequis : Docker Desktop. Aucun .NET, Node ni SQL Server à installer.

```bash
cp .env.example .env            # puis modifiez les mots de passe dans .env
docker compose up --build -d    # 1er lancement : quelques minutes (téléchargement des images)
# → http://localhost:8080  (connexion avec COMPTE_COURRIEL / COMPTE_MOT_DE_PASSE du .env)

docker compose logs -f api      # journaux de l'API
docker compose down             # arrêter (les données sont conservées)
docker compose down -v          # arrêter ET effacer la base locale
```

```
navigateur ──▶ web (nginx :8080) ──/api──▶ api (.NET :8080) ──▶ sql (SQL Server, volume sql-donnees)
```

| Choix | Pourquoi |
|---|---|
| Images **multi-étapes** | On compile avec le SDK / Node, on n'expédie que le runtime : API ≈ 400 Mo, site ≈ 75 Mo |
| `.csproj` / `package.json` copiés **avant** le code | Docker réutilise le cache du `restore` / `npm ci` tant que les dépendances ne changent pas |
| Utilisateurs **non-root** (`$APP_UID`, `nginx-unprivileged`) | Un conteneur compromis n'a pas les droits root |
| **nginx relaie `/api`** | Site et API sur la même origine : pas de CORS, cookie `SameSite=Strict` inchangé (comme le proxy Vite) |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | Derrière nginx / Azure, l'API voit le vrai schéma (`https`) et la vraie IP |
| Clés du cookie **dans la base** (table `DataProtectionKeys`) | Elles survivent aux redémarrages et sont partagées entre conteneurs : on reste connecté |
| `Demarrage:AppliquerMigrations=true` | Hors dev, migrations + compte initial seulement si on le demande explicitement |
| `Authentification:CookieHttpsObligatoire=false` | Seulement en local (http). En Azure (https) le cookie reste `Secure` |
| **SQL Server en conteneur** (`localhost,14333` dans SSMS) | Base locale jetable, indépendante d'Azure SQL ; `healthcheck` → l'API attend qu'elle soit prête |

> La base du `docker compose` est **locale**. Dans Azure, l'API utilise Azure SQL (voir ci-dessous).

---

## Déploiement Azure (Terraform)

```
Internet ──▶ ca-naissances-web (nginx, public, naissance.anmbo.ca)
                  │ /api (interne, HTTPS)
                  ▼
             ca-naissances-api (.NET, INTERNE) ──identité managée, sans mot de passe──▶ Azure SQL db-naissances
                  ▲ images tirées par identité (AcrPull)
             acrnaissancesdoudou (registre Docker)
```

| Ressource | Nom | Gestion |
|---|---|---|
| Groupe de ressources | `rg-naissances` | **importé** (créé par script) |
| Serveur + base SQL | `sql-naissances-doudou` / `db-naissances` (S0) | **importés**, `prevent_destroy` |
| Règle pare-feu | `AllowAllWindowsAzureIps` | créée : les conteneurs n'ont pas d'IP fixe ; sans risque car le serveur n'accepte que Entra ID |
| Journaux | `log-naissances` | créé (30 jours) |
| Environnement | `cae-naissances` | créé (Consumption) |
| Registre d'images | `acrnaissancesdoudou` | créé (Basic, compte admin désactivé) |
| Identités | `id-naissances-api`, `id-naissances-web` | créées ; seule l'API a accès à la base |
| Applications | `ca-naissances-api` (interne), `ca-naissances-web` (public) | créées quand `image_tag` est renseigné ; API 1 à 2 réplicas, site 0 à 2 |

Choix :
* **Import** plutôt que recréation : `imports.tf` (blocs `import`, Terraform ≥ 1.5). Le 1er plan n'ajoute que des étiquettes.
* **Aucun secret** : l'API se connecte à SQL avec `Authentication=Active Directory Managed Identity`, et tire
  ses images par identité. Le compte de connexion existe déjà dans la base (créé en dev).
* **API interne** : seul nginx (le site) peut l'appeler ; même origine → cookie `SameSite=Strict` inchangé.
* **API toujours allumée (`min_replicas = 1`)** : avec 0, l'API s'éteignait sans visiteurs et le 1er appel
  après une pause attendait ~20 s de démarrage à froid (journaux du 2026-11-19 ; plus de 40 s ressentis à
  l'enregistrement). Coût estimé : ≈ 8 à 10 $ US/mois (tarif « inactif » Container Apps, moins la part gratuite).
  Le **site** (nginx) garde `min_replicas = 0` : il démarre en 1 à 2 s.
* **Onglet ouvert pendant un déploiement** : les fichiers JS ont des noms hachés, les anciens disparaissent.
  `main.tsx` intercepte `vite:preloadError` et recharge la page une fois (au plus toutes les 10 s) ; `index.html`
  est servi en `no-cache`, donc le rechargement récupère la nouvelle version.
* État Terraform **partagé dans Azure** : `rg-naissances-tfstate` / `stnaissancestfstate` / conteneur `tfstate` /
  `naissances.tfstate`. Accès Entra ID seulement (clés désactivées), verrou automatique, versions + corbeille 14 j.
  Il faut le rôle **Storage Blob Data Contributor** sur ce compte pour lancer Terraform.
* `resource_provider_registrations = "none"` : Terraform ne touche pas à l'abonnement, le pipeline n'a de droits
  que sur `rg-naissances`.

### Procédure (première fois)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # compléter (abonnement, admin SQL)
terraform init

# 1) Socle : imports + registre + identités (image_tag vide)
terraform plan -out=phase1.tfplan && terraform apply phase1.tfplan

# 2) Autoriser l'identité de l'API dans la base (une fois) :
#    portail Azure > db-naissances > Éditeur de requête (Entra) > exécuter backend/sql/acces-api-azure.sql

# 3) Construire et pousser les images
az acr login -n acrnaissancesdoudou
docker build -t acrnaissancesdoudou.azurecr.io/naissances-api:v1 ../backend
docker build -t acrnaissancesdoudou.azurecr.io/naissances-web:v1 ../frontend
docker push acrnaissancesdoudou.azurecr.io/naissances-api:v1
docker push acrnaissancesdoudou.azurecr.io/naissances-web:v1

# 4) Applications : image_tag = "v1" dans terraform.tfvars
terraform apply
terraform output     # adresse Azure du site + CNAME et TXT pour GoDaddy
```

---

## CI/CD — Azure DevOps

Projet : **https://dev.azure.com/DougMbo/AppNaissance** — le code reste sur GitHub, Azure Pipelines l'exécute.

```
Pull Request ──▶ CI ──▶ ✅/❌ affiché sur la PR GitHub
Fusion main  ──▶ CI ──▶ Images (push ACR, tag b<numéro>) ──▶ Plan Terraform ──▶ ⏸ approbation ──▶ Production
```

| Étape | Contenu |
|---|---|
| **CI** | .NET : build `-warnaserror`, tests (résultats publiés), **échec si package NuGet vulnérable** · React : `npm ci`, typecheck, Vitest (JUnit publié), build · PR : build des 2 images Docker sans publication |
| **Images** | `main` seulement : build + push `naissances-api` / `naissances-web:b<BuildId>` dans `acrnaissancesdoudou` |
| **Plan** | `terraform plan` avec la nouvelle version ; le plan est conservé comme artefact |
| **Production** | environnement **`production` avec approbation** → `terraform apply` du plan approuvé (exactement celui-là), puis test de https://naissance.anmbo.ca (site 200, API 401) |

* **Aucun secret** : connexion de service `sc-naissances-azure` en *Workload Identity Federation* (jeton OIDC
  court transmis à Terraform via `ARM_USE_OIDC`). Les variables Terraform (abonnement, admin SQL) sont lues
  dans Azure par [pipelines/terraform.sh](pipelines/terraform.sh).
* Droits de la connexion : **Contributor sur `rg-naissances`** + **Storage Blob Data Contributor** sur l'état Terraform.
* Terraform est installé en **version fixe** (1.15.8) et les fournisseurs sont figés par `.terraform.lock.hcl`.

### Mise en place (une seule fois)

1. **Connexion de service** : Project settings → Service connections → New → *Azure Resource Manager* →
   *Workload Identity federation (automatic)* → abonnement « Doudou Mbombo », groupe **`rg-naissances`**,
   nom **`sc-naissances-azure`**.
2. Donner l'accès à l'état Terraform à cette connexion (Azure CLI, `Storage Blob Data Contributor` sur
   `stnaissancestfstate`).
3. **Environnement** : Pipelines → Environments → New → `production` → *Approvals and checks* → *Approvals* → vous.
4. **Pipeline** : Pipelines → New pipeline → GitHub (YAML) → `Doug012345/naissance` →
   *Existing Azure Pipelines YAML file* → `/azure-pipelines.yml`.
5. **GitHub** : Settings → Branches → règle sur `main` → *Require status checks to pass* → le check Azure Pipelines.

### Dépannage

| Symptôme | Cause / solution |
|---|---|
| `/api/...` répond **426 Upgrade Required** | nginx parle HTTP/1.0 par défaut ; la passerelle Azure exige 1.1 → `proxy_http_version 1.1;` (déjà dans `nginx.conf.template`) |
| `/api/...` répond **504**, journaux : `Login failed for user '<token-identified principal>'` | L'identité de l'API n'existe pas dans **db-naissances** : exécuter `backend/sql/acces-api-azure.sql` sur la **base** (pas sur `master`), puis `az containerapp revision restart` |
| Lire les journaux de l'API | `az containerapp logs show -g rg-naissances -n ca-naissances-api --tail 50`, ou Log Analytics `log-naissances` → `ContainerAppConsoleLogs_CL` |

### Domaine personnalisé `naissance.anmbo.ca` ✅ en ligne

Site : **https://naissance.anmbo.ca**. Le certificat HTTPS (GeoTrust/DigiCert) est géré et renouvelé
automatiquement par Azure, et `http://` redirige vers `https://`.

> Azure rattache les applications au profil « Consumption » : `workload_profile_name` est écrit dans
> `main.tf`, sinon `terraform plan` voudrait le retirer. Le lien du domaine (fait par `az containerapp hostname`)
> n'est pas géré par Terraform et n'apparaît donc pas dans le plan.

Procédure (déjà faite, à refaire seulement pour un autre domaine) :

1. Chez GoDaddy (DNS de `anmbo.ca`), ajouter les deux enregistrements donnés par `terraform output` :
   `CNAME naissance → <adresse du site>` et `TXT asuid.naissance → <code de vérification>`.
   Ne pas toucher aux enregistrements existants.
2. Après propagation (quelques minutes) : lier le domaine et créer le certificat HTTPS gratuit géré par Azure :
   ```bash
   az containerapp hostname add  -g rg-naissances -n ca-naissances-web --hostname naissance.anmbo.ca
   az containerapp hostname bind -g rg-naissances -n ca-naissances-web --hostname naissance.anmbo.ca \
     --environment cae-naissances --validation-method CNAME
   ```

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

## Certificat de naissance (impression et PDF)

Fiche d'une naissance → **🖨 Certificat (imprimer ou PDF)** → `/naissances/{id}/certificat`, puis :

* **Imprimer le certificat** : version HTML, format A4, boîte d'impression du navigateur ;
* **⬇ Télécharger (PDF)** : `POST /api/naissances/{id}/certificat.pdf`. L'**API** fabrique le PDF (A4,
  vectoriel, texte sélectionnable) : `Infrastructure/Certificats/GenerateurCertificatPdf.cs`. Fichier
  `certificat-N-2026-000001-copie-3.pdf`, en-tête `X-Numero-Copie`, `Cache-Control: no-store`. POST et non GET :
  chaque téléchargement crée une copie journalisée, comme une impression.

| Élément | Détail |
|---|---|
| En-tête et sceau | « **Commune de X** » : X = champ **Commune** saisi à l'enregistrement (obligatoire). Sceau rond en SVG, propre à l'application (n'imite aucun sceau officiel) |
| Code de vérification | 8 caractères aléatoires (générateur cryptographique, alphabet de Crockford sans I/L/O/U), ex. `K7QF-9M2X`, unique par acte |
| QR code | pointe vers `https://naissance.anmbo.ca/verifier/K7QF-9M2X` |
| Copie n° | chaque impression appelle d'abord `POST /api/naissances/{id}/delivrances` ; chaque PDF passe par le même cas d'utilisation. La copie est **journalisée** (table `etatcivil.DelivrancesCertificat` : qui, quand, n°) |
| Anti-copie | fond guilloché et micro-texte (une photocopie les rend flous) |
| Acte annulé | imprimable, mais avec un grand filigrane rouge **ANNULÉ** |
| Acte rectifié | ligne « Acte rectifié le … » ; le code (et donc le QR) est **nouveau** après chaque rectification |

**PDF côté serveur — détails techniques**

* **QuestPDF** (mise en page) + **QRCoder** (QR code dessiné en vecteurs). La police **Lato** est livrée avec
  QuestPDF : rien à installer dans l'image Docker Linux (vérifié dans le conteneur).
* Sceau : anneaux et étoiles en SVG, lettres posées une à une sur le cercle (QuestPDF n'a pas de « texte sur
  un chemin »). Dates en français écrites par le code (ne dépend pas de la culture du conteneur), à l'heure du
  Québec (`America/Toronto`).
* Le QR code pointe vers `Certificat:UrlSite` (`appsettings.json` : `https://naissance.anmbo.ca` ;
  docker compose : `http://localhost:8080`).
* ⚠️ **Licence QuestPDF « Community »** : gratuite pour un particulier ou une organisation de moins de
  1 M$ US de revenus annuels, **mais pas pour les organismes publics ou gouvernementaux**, quels que soient
  leurs revenus. Si une vraie commune utilise l'application, il faut une licence payante ou une autre
  bibliothèque (PDFsharp/MigraDoc, licence MIT).

**Pourquoi un QR code ?** Un sceau imprimé se recopie facilement. Ce qui prouve qu'un certificat est
authentique, c'est la page de vérification : elle interroge la base au moment du scan.

**Vérification publique** — `/verifier` (saisie du code) et `/verifier/{code}`, **sans connexion** :

| Route API | Résultat |
|---|---|
| `GET /api/verification/{code}` | 200 `{ numeroActe, initialesEnfant, dateNaissance, commune, statut, dateEnregistrementUtc, dateRectificationUtc, remplace }`, 404 si inconnu, **429** au-delà de 20 requêtes/minute par adresse IP |

* `remplace: true` : code d'un certificat imprimé **avant** une rectification. La page affiche
  « ⚠️ Certificat REMPLACÉ (acte rectifié) » avec la date de la rectification.

* Loi 25 / vie privée : seulement les **initiales** de l'enfant, aucun parent ni lieu précis. La personne
  qui vérifie compare avec le papier qu'elle a en main.
* Saisie tolérante : minuscules, tirets, espaces, et `O`→`0`, `I`/`L`→`1`.
* Les actes enregistrés avant cette fonctionnalité ont reçu, par la migration `CertificatVerification`,
  un code aléatoire et une commune égale à leur ville.

---

## Rectification d'un acte

Un acte d'état civil ne se « modifie » pas en silence : il se **rectifie**, et chaque changement reste tracé.

Fiche → **✏️ Rectifier** (acte *Enregistré* seulement) → `/naissances/{id}/rectifier` : le formulaire de
déclaration, prérempli, avec un **motif obligatoire** (10 à 500 caractères).

| Règle | Où |
|---|---|
| Acte annulé → refus | `Naissance.Rectifier` (domaine) |
| Aucune modification → 422 « Aucune modification » | domaine |
| Mêmes règles qu'à l'enregistrement (poids, taille, âge des parents…) | domaine (méthode `Valider` partagée) + Zod |
| Date de naissance : au plus 30 jours **avant l'enregistrement de l'acte**, et pas après lui (et non plus 30 jours avant aujourd'hui) | domaine + Zod (`dateReference`) |
| Ne changent jamais : numéro d'acte, date d'enregistrement, journal des copies | domaine |
| Nouveau **code de vérification** ; l'ancien est gardé dans l'historique | domaine |
| Deux agents en même temps → **409** (rowversion), le formulaire se recharge avec un message | API + `RectificationPage` |

| Route API | Résultat |
|---|---|
| `POST /api/naissances/{id}/rectifications` | corps `{ donnees: { …mêmes champs que l'enregistrement }, motif, version }` → 204 ; 422 ; 409 |
| `GET /api/naissances/{id}/rectifications` | historique, le plus récent d'abord : `{ dateRectificationUtc, rectifiePar, motif, changements: [{ champ, ancienneValeur, nouvelleValeur }] }` |

* Table `etatcivil.RectificationsNaissance` (migration `RectificationNaissance`) : agent, date, motif,
  `AncienCodeVerification` (index unique, cherché par la page publique) et une colonne JSON `Changements`.
  Nouvelle colonne `Naissances.DateDerniereRectificationUtc`. La migration ne fait qu'**ajouter** :
  aucune donnée existante n'est modifiée.
* La fiche affiche « Dernière rectification » et l'**historique** (avant barré en rouge, après en vert).
* Tous les agents connectés peuvent rectifier (pas encore de rôles, voir « Pistes d'évolution »).

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
* Certificat : impression journalisée, téléchargement PDF (nom du fichier, n° de copie, erreur), filigrane
  ANNULÉ, vérification publique (authentique, inconnu, annulé, **remplacé**, 429).
* Rectification : formulaire prérempli, historique avant → après, nouveau code, motif obligatoire, date
  postérieure à l'enregistrement refusée, 409, pas de bouton sur un acte annulé.
* `setup.ts` : `asyncUtilTimeout` à 3 s (au lieu de 1 s) pour éviter de faux échecs sur un agent CI chargé.
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
* Key Vault le jour où un secret sera nécessaire (aujourd'hui : aucun, tout passe par identité managée).
* Tests d'intégration de l'API dans le pipeline (SQL Server en conteneur de service).
* Certificat PDF **signé numériquement** (certificat X.509 dans Key Vault), si un jour un PDF « officiel » est exigé.
* Rôle « superviseur » obligatoire pour rectifier un acte.
* Une base de **développement** séparée (aujourd'hui `appsettings.json` pointe vers la production).
