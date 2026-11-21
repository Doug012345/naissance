import { http, HttpResponse } from 'msw';
import type {
  EnregistrerNaissanceRequete,
  NaissanceDetail,
  NaissanceResume,
  Rectification,
} from '../api/naissances';

/**
 * MSW intercepte fetch au niveau réseau : les composants appellent la VRAIE
 * couche API (client.ts), seul le serveur est simulé. Aucun mock de module.
 */
export const fixtures: NaissanceDetail[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    numeroActe: 'N-2026-000001',
    prenom: 'Léa',
    nom: 'TREMBLAY',
    sexe: 'Feminin',
    dateHeureNaissance: '2026-11-10T08:30:00',
    etablissement: 'CHU Sainte-Justine',
    ville: 'Montréal',
    commune: 'Montréal',
    codeVerification: 'K7QF9M2X',
    poidsGrammes: 3400,
    tailleCm: 50.5,
    mere: { prenom: 'Marie', nom: 'TREMBLAY', dateNaissance: '1994-03-02' },
    secondParent: null,
    statut: 'Enregistree',
    motifAnnulation: null,
    dateEnregistrementUtc: '2026-11-10T15:00:00',
    version: 'AAAAAAAAB9E=',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    numeroActe: 'N-2026-000002',
    prenom: 'Noah',
    nom: 'GAGNON',
    sexe: 'Masculin',
    dateHeureNaissance: '2026-11-12T22:10:00',
    etablissement: 'Hôpital de l’Enfant-Jésus',
    ville: 'Québec',
    commune: 'Québec',
    codeVerification: 'A1B2C3D4',
    poidsGrammes: 3650,
    tailleCm: 52,
    mere: { prenom: 'Julie', nom: 'GAGNON', dateNaissance: '1990-07-15' },
    secondParent: { prenom: 'Marc', nom: 'GAGNON', dateNaissance: '1988-01-20' },
    statut: 'Enregistree',
    motifAnnulation: null,
    dateEnregistrementUtc: '2026-11-13T09:00:00',
    version: 'AAAAAAAAB9F=',
  },
];

let db: NaissanceDetail[] = [];
let copies: Record<string, number> = {};
let rectifications: Record<string, (Rectification & { ancienCode: string })[]> = {};
export const reinitialiserDb = () => {
  db = structuredClone(fixtures);
  copies = {};
  rectifications = {};
};

const nouvelleCopie = (id: string) => (copies[id] = (copies[id] ?? 0) + 1);

const resume = (n: NaissanceDetail): NaissanceResume => ({
  id: n.id,
  numeroActe: n.numeroActe,
  nomCompletEnfant: `${n.prenom} ${n.nom}`,
  sexe: n.sexe,
  dateHeureNaissance: n.dateHeureNaissance,
  ville: n.ville,
  statut: n.statut,
});

export const utilisateurTest = { courriel: 'agent@exemple.ca' };
export const MOT_DE_PASSE_TEST = 'Ancien-MotDePasse1';
export const JETON_VALIDE = 'jeton-valide';

export const handlers = [
  // Par défaut l'utilisateur est connecté ; les tests d'auth surchargent avec server.use().
  http.get('/api/auth/moi', () => HttpResponse.json(utilisateurTest)),

  http.post('/api/auth/connexion', async ({ request }) => {
    const { courriel, motDePasse } = (await request.json()) as { courriel: string; motDePasse: string };
    return courriel === utilisateurTest.courriel && motDePasse === MOT_DE_PASSE_TEST
      ? HttpResponse.json(utilisateurTest)
      : HttpResponse.json(
          { status: 401, title: 'Connexion refusée', detail: 'Courriel ou mot de passe invalide.' },
          { status: 401 },
        );
  }),

  http.post('/api/auth/deconnexion', () => new HttpResponse(null, { status: 204 })),

  http.post('/api/auth/mot-de-passe', async ({ request }) => {
    const { motDePasseActuel } = (await request.json()) as { motDePasseActuel: string };
    if (motDePasseActuel !== MOT_DE_PASSE_TEST) {
      return HttpResponse.json(
        {
          status: 422,
          title: 'Mot de passe non modifié',
          errors: { motDePasseActuel: ['Le mot de passe actuel est incorrect.'] },
        },
        { status: 422 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Comme l'API : 202 toujours, que le compte existe ou non.
  http.post('/api/auth/mot-de-passe-oublie', () => new HttpResponse(null, { status: 202 })),

  http.post('/api/auth/reinitialisation', async ({ request }) => {
    const { jeton } = (await request.json()) as { utilisateurId: string; jeton: string; nouveauMotDePasse: string };
    if (jeton !== JETON_VALIDE) {
      const message = 'Ce lien n’est plus valide (expiré ou déjà utilisé). Faites une nouvelle demande.';
      return HttpResponse.json(
        { status: 422, title: 'Mot de passe non réinitialisé', detail: message, errors: { jeton: [message] } },
        { status: 422 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/naissances', ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('recherche') ?? '').toLowerCase();
    const statut = url.searchParams.get('statut');
    const page = Number(url.searchParams.get('page') ?? 1);
    const taille = Number(url.searchParams.get('taille') ?? 10);

    const filtres = db.filter(
      (n) =>
        (!q || `${n.prenom} ${n.nom} ${n.numeroActe}`.toLowerCase().includes(q)) &&
        (!statut || n.statut === statut),
    );
    return HttpResponse.json({
      elements: filtres.slice((page - 1) * taille, page * taille).map(resume),
      page,
      taille,
      total: filtres.length,
      totalPages: Math.ceil(filtres.length / taille),
    });
  }),

  http.get('/api/naissances/:id', ({ params }) => {
    const n = db.find((x) => x.id === params.id);
    return n
      ? HttpResponse.json(n)
      : HttpResponse.json({ status: 404, title: 'Introuvable' }, { status: 404 });
  }),

  http.post('/api/naissances', async () =>
    HttpResponse.json({ id: '33333333-3333-3333-3333-333333333333' }, { status: 201 }),
  ),

  http.post('/api/naissances/:id/delivrances', ({ params }) => {
    const n = db.find((x) => x.id === params.id);
    if (!n) return HttpResponse.json({ status: 404 }, { status: 404 });
    return HttpResponse.json(
      { numeroCopie: nouvelleCopie(n.id), dateDelivranceUtc: '2026-11-19T14:00:00Z', delivrePar: utilisateurTest.courriel },
      { status: 201 },
    );
  }),

  http.post('/api/naissances/:id/certificat.pdf', ({ params }) => {
    const n = db.find((x) => x.id === params.id);
    if (!n) return HttpResponse.json({ status: 404 }, { status: 404 });
    const copie = nouvelleCopie(n.id);
    return new HttpResponse('%PDF-1.7 faux', {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=certificat-${n.numeroActe}-copie-${copie}.pdf`,
        'X-Numero-Copie': String(copie),
      },
    });
  }),

  http.get('/api/naissances/:id/rectifications', ({ params }) =>
    HttpResponse.json((rectifications[String(params.id)] ?? []).map(({ ancienCode: _, ...r }) => r)),
  ),

  // Comme l'API : 409 si version périmée, 422 si rien ne change, nouveau code de vérification.
  http.post('/api/naissances/:id/rectifications', async ({ params, request }) => {
    const { donnees, motif, version } = (await request.json()) as {
      donnees: EnregistrerNaissanceRequete;
      motif: string;
      version: string;
    };
    const n = db.find((x) => x.id === params.id);
    if (!n) return HttpResponse.json({ status: 404 }, { status: 404 });
    if (n.version !== version) {
      return HttpResponse.json({ status: 409, title: 'Conflit de modification' }, { status: 409 });
    }
    const changements = (['prenom', 'nom', 'commune', 'ville', 'etablissement'] as const)
      .filter((c) => n[c] !== donnees[c])
      .map((c) => ({ champ: c, ancienneValeur: n[c], nouvelleValeur: donnees[c] }));
    if (changements.length === 0) {
      return HttpResponse.json(
        { status: 422, detail: 'Aucune modification.', errors: { general: ['Aucune modification.'] } },
        { status: 422 },
      );
    }
    const date = '2026-11-19T15:00:00';
    (rectifications[n.id] ??= []).unshift({
      dateRectificationUtc: date,
      rectifiePar: utilisateurTest.courriel,
      motif,
      changements,
      ancienCode: n.codeVerification,
    });
    Object.assign(n, donnees, {
      codeVerification: 'NEUF2345',
      dateDerniereRectificationUtc: date,
      version: 'RECTIFIEE=',
    });
    return new HttpResponse(null, { status: 204 });
  }),

  // Comme l'API : saisie tolérante (minuscules, tiret) et infos minimales ; ancien code → « remplacé ».
  http.get('/api/verification/:code', ({ params }) => {
    const code = String(params.code).toUpperCase().replace(/[-\s]/g, '');
    let n = db.find((x) => x.codeVerification === code);
    let rectification = null;
    if (!n) {
      for (const [id, liste] of Object.entries(rectifications)) {
        const r = liste.find((x) => x.ancienCode === code);
        if (r) {
          n = db.find((x) => x.id === id);
          rectification = r;
        }
      }
    }
    if (!n) return HttpResponse.json({ status: 404, title: 'Certificat introuvable' }, { status: 404 });
    return HttpResponse.json({
      numeroActe: n.numeroActe,
      initialesEnfant: `${n.prenom[0]}. ${n.nom[0]}.`,
      dateNaissance: n.dateHeureNaissance.slice(0, 10),
      commune: n.commune,
      statut: n.statut,
      dateEnregistrementUtc: n.dateEnregistrementUtc,
      dateRectificationUtc: rectification?.dateRectificationUtc ?? n.dateDerniereRectificationUtc ?? null,
      remplace: rectification !== null,
    });
  }),

  http.post('/api/naissances/:id/annulation', async ({ params, request }) => {
    const { motif, version } = (await request.json()) as { motif: string; version: string };
    const n = db.find((x) => x.id === params.id);
    if (!n) return HttpResponse.json({ status: 404 }, { status: 404 });
    if (n.version !== version) {
      return HttpResponse.json({ status: 409, title: 'Conflit de modification' }, { status: 409 });
    }
    n.statut = 'Annulee';
    n.motifAnnulation = motif;
    n.version = 'NOUVELLE=';
    return new HttpResponse(null, { status: 204 });
  }),
];
