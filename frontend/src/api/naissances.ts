import { http } from './client';

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
  poidsGrammes: number;
  tailleCm: number;
  mere: Parent;
  secondParent: Parent | null;
  statut: StatutNaissance;
  motifAnnulation: string | null;
  dateEnregistrementUtc: string;
  version: string;
}

export interface EnregistrerNaissanceRequete {
  prenom: string;
  nom: string;
  sexe: Sexe;
  dateHeureNaissance: string;
  etablissement: string;
  ville: string;
  poidsGrammes: number;
  tailleCm: number;
  mere: Parent;
  secondParent: Parent | null;
}

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
};

export const libellesSexe: Record<Sexe, string> = {
  Feminin: 'Féminin',
  Masculin: 'Masculin',
  Indetermine: 'Indéterminé',
};
