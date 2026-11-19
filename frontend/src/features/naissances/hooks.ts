import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  naissancesApi,
  type FiltresNaissances,
  type NaissanceDetail,
  type NaissanceResume,
  type PageResultat,
} from '../../api/naissances';

/**
 * Fabrique de clés de cache : UNE seule source de vérité pour toutes les clés.
 * Hiérarchie → invalider ['naissances'] invalide tout, ['naissances','liste'] seulement les listes.
 */
export const naissancesKeys = {
  all: ['naissances'] as const,
  listes: () => [...naissancesKeys.all, 'liste'] as const,
  liste: (f: FiltresNaissances) => [...naissancesKeys.listes(), f] as const,
  details: () => [...naissancesKeys.all, 'detail'] as const,
  detail: (id: string) => [...naissancesKeys.details(), id] as const,
};

/** queryOptions : réutilisable dans useQuery, prefetchQuery, loaders du routeur… */
export const listeNaissancesQuery = (f: FiltresNaissances) =>
  queryOptions({
    queryKey: naissancesKeys.liste(f),
    queryFn: ({ signal }) => naissancesApi.rechercher(f, signal), // signal → requête annulée si le filtre change
    placeholderData: keepPreviousData, // pas de « flash » vide en changeant de page
    staleTime: 30_000,
  });

export const detailNaissanceQuery = (id: string) =>
  queryOptions({
    queryKey: naissancesKeys.detail(id),
    queryFn: ({ signal }) => naissancesApi.obtenir(id, signal),
  });

export function useNaissances(f: FiltresNaissances) {
  return useQuery(listeNaissancesQuery(f));
}

export function useNaissance(id: string) {
  return useQuery(detailNaissanceQuery(id));
}

/** Journalise une copie du certificat juste avant l'impression (renvoie le n° de copie). */
export function useDelivrerCertificat() {
  return useMutation({ mutationFn: (id: string) => naissancesApi.delivrer(id) });
}

/** Page publique : vérifie un code de certificat (pas de cache partagé avec l'espace connecté). */
export function useVerification(code: string) {
  return useQuery({
    queryKey: ['verification', code],
    queryFn: ({ signal }) => naissancesApi.verifier(code, signal),
    enabled: code.length > 0,
    retry: false,
  });
}

export function useEnregistrerNaissance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: naissancesApi.enregistrer,
    // Une nouvelle naissance change le contenu (et le total) de toutes les listes.
    onSuccess: () => qc.invalidateQueries({ queryKey: naissancesKeys.listes() }),
  });
}

interface AnnulerVariables {
  id: string;
  motif: string;
  version: string;
}

/**
 * Annulation avec MISE À JOUR OPTIMISTE :
 * 1. onMutate  : on affiche tout de suite « Annulée » (snapshot gardé pour rollback)
 * 2. onError   : on restaure le snapshot (ex. 409 conflit de version)
 * 3. onSettled : on resynchronise avec le serveur (nouvelle rowversion)
 */
export function useAnnulerNaissance() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, motif, version }: AnnulerVariables) => naissancesApi.annuler(id, motif, version),

    onMutate: async ({ id, motif }) => {
      await qc.cancelQueries({ queryKey: naissancesKeys.detail(id) });
      const precedent = qc.getQueryData<NaissanceDetail>(naissancesKeys.detail(id));

      qc.setQueryData<NaissanceDetail>(naissancesKeys.detail(id), (old) =>
        old ? { ...old, statut: 'Annulee', motifAnnulation: motif } : old,
      );
      // Les listes en cache affichent aussi le nouveau statut.
      qc.setQueriesData<PageResultat<NaissanceResume>>({ queryKey: naissancesKeys.listes() }, (old) =>
        old
          ? { ...old, elements: old.elements.map((n) => (n.id === id ? { ...n, statut: 'Annulee' } : n)) }
          : old,
      );

      return { precedent };
    },

    onError: (_err, { id }, contexte) => {
      if (contexte?.precedent) qc.setQueryData(naissancesKeys.detail(id), contexte.precedent);
      void qc.invalidateQueries({ queryKey: naissancesKeys.listes() });
    },

    onSettled: (_data, _err, { id }) => qc.invalidateQueries({ queryKey: naissancesKeys.detail(id) }),
  });
}
