import { http, HttpResponse } from 'msw';
import type { NaissanceDetail, NaissanceResume } from '../api/naissances';

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
export const reinitialiserDb = () => {
  db = structuredClone(fixtures);
};

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
