import { http, telecharger } from './client';

// Types miroir des DTO C# (Naissances.Application/Naissances/Contrats.cs).
// En projet réel : générés depuis /openapi/v1.json (openapi-typescript, orval…).

export type Sexe = 'Feminin' | 'Masculin' | 'Indetermine';
export type StatutNaissance = 'Enregistree' | 'Annulee';

export interface PageResultat<T> {
  elements: T[];
  page: number;
  taille: number;
  total: number;
  totalPages: number;
}

export interface NaissanceResume {
  id: string;
  numeroActe: string;
  nomCompletEnfant: string;
  sexe: Sexe;
  dateHeureNaissance: string;
  ville: string;
  statut: StatutNaissance;
}

export interface Parent {
  prenom: string;
  nom: string;
  dateNaissance: string; // "YYYY-MM-DD" (DateOnly)
}

export interface NaissanceDetail {
  id: string;
  numeroActe: string;
  prenom: string;
  nom: string;
  sexe: Sexe;
  dateHeureNaissance: string;
  etablissement: string;
  ville: string;
  /** Commune où l'acte est enregistré (en-tête et sceau du certificat). */
  commune: string;
  /** Code du QR code, 8 caractères sans tiret (ex. « K7QF9M2X »). */
  codeVerification: string;
  poidsGrammes: number;
  tailleCm: number;
  mere: Parent;
  secondParent: Parent | null;
  statut: StatutNaissance;
  motifAnnulation: string | null;
  dateEnregistrementUtc: string;
  /** Date de la dernière rectification (absente ou null si jamais rectifié). */
  dateDerniereRectificationUtc?: string | null;
  version: string;
}

export interface EnregistrerNaissanceRequete {
  prenom: string;
  nom: string;
  sexe: Sexe;
  dateHeureNaissance: string;
  etablissement: string;
  ville: string;
  commune: string;
  poidsGrammes: number;
  tailleCm: number;
  mere: Parent;
  secondParent: Parent | null;
}

/** Une impression du certificat (copie numérotée, journalisée côté serveur). */
export interface Delivrance {
  numeroCopie: number;
  dateDelivranceUtc: string;
  delivrePar: string;
}

/** Réponse publique de la page de vérification : le strict minimum. */
export interface Verification {
  numeroActe: string;
  initialesEnfant: string;
  dateNaissance: string;
  commune: string;
  statut: StatutNaissance;
  dateEnregistrementUtc: string;
  /** Rectification de l'acte (si remplace : celle qui a rendu ce certificat obsolète). */
  dateRectificationUtc?: string | null;
  /** true : code d'un certificat imprimé AVANT une rectification → plus à jour. */
  remplace?: boolean;
}

export interface Changement {
  champ: string;
  ancienneValeur: string;
  nouvelleValeur: string;
}

/** Une entrée de l'historique des rectifications. */
export interface Rectification {
  dateRectificationUtc: string;
  rectifiePar: string;
  motif: string;
  changements: Changement[];
}

/** « K7QF9M2X » → « K7QF-9M2X » (plus facile à lire et à recopier). */
export const formaterCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

export interface FiltresNaissances {
  recherche?: string;
  statut?: StatutNaissance;
  page: number;
  taille: number;
}

export const naissancesApi = {
  rechercher(f: FiltresNaissances, signal?: AbortSignal) {
    const qs = new URLSearchParams({ page: String(f.page), taille: String(f.taille) });
    if (f.recherche) qs.set('recherche', f.recherche);
    if (f.statut) qs.set('statut', f.statut);
    return http<PageResultat<NaissanceResume>>(`/api/naissances?${qs}`, { signal });
  },

  obtenir(id: string, signal?: AbortSignal) {
    return http<NaissanceDetail>(`/api/naissances/${id}`, { signal });
  },

  enregistrer(requete: EnregistrerNaissanceRequete) {
    return http<{ id: string }>('/api/naissances', {
      method: 'POST',
      body: JSON.stringify(requete),
    });
  },

  annuler(id: string, motif: string, version: string) {
    return http<void>(`/api/naissances/${id}/annulation`, {
      method: 'POST',
      body: JSON.stringify({ motif, version }),
    });
  },

  delivrer(id: string) {
    return http<Delivrance>(`/api/naissances/${id}/delivrances`, { method: 'POST' });
  },

  rectifier(id: string, donnees: EnregistrerNaissanceRequete, motif: string, version: string) {
    return http<void>(`/api/naissances/${id}/rectifications`, {
      method: 'POST',
      body: JSON.stringify({ donnees, motif, version }),
    });
  },

  rectifications(id: string, signal?: AbortSignal) {
    return http<Rectification[]>(`/api/naissances/${id}/rectifications`, { signal });
  },

  /** PDF fabriqué par l'API : chaque téléchargement est une copie numérotée et journalisée. */
  telechargerPdf(id: string) {
    return telecharger(`/api/naissances/${id}/certificat.pdf`);
  },

  verifier(code: string, signal?: AbortSignal) {
    return http<Verification>(`/api/verification/${encodeURIComponent(code)}`, { signal });
  },
};

export const libellesSexe: Record<Sexe, string> = {
  Feminin: 'Féminin',
  Masculin: 'Masculin',
  Indetermine: 'Indéterminé',
};
