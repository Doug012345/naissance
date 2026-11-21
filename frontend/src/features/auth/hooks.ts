import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { authApi, type Utilisateur } from '../../api/auth';

export const sessionKey = ['session'] as const;

/**
 * La session est un état SERVEUR comme un autre → TanStack Query.
 * `null` = pas connecté (401 transformé en valeur, pas en erreur).
 */
export const sessionQuery = queryOptions({
  queryKey: sessionKey,
  queryFn: async ({ signal }): Promise<Utilisateur | null> => {
    try {
      return await authApi.moi(signal);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  staleTime: Infinity, // invalidée explicitement (connexion, déconnexion, 401)
});

export function useSession() {
  return useQuery(sessionQuery);
}

export function useConnexion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courriel, motDePasse }: { courriel: string; motDePasse: string }) =>
      authApi.connexion(courriel, motDePasse),
    onSuccess: (utilisateur) => qc.setQueryData(sessionKey, utilisateur),
  });
}

export function useDeconnexion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.deconnexion,
    onSettled: () => {
      // On vide le cache : l'utilisateur suivant ne doit pas voir les données du précédent.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== sessionKey[0] });
      qc.setQueryData(sessionKey, null);
    },
  });
}

export function useChangerMotDePasse() {
  return useMutation({ mutationFn: authApi.changerMotDePasse });
}

export function useMotDePasseOublie() {
  return useMutation({ mutationFn: authApi.motDePasseOublie });
}

export function useReinitialiserMotDePasse() {
  return useMutation({ mutationFn: authApi.reinitialiser });
}
