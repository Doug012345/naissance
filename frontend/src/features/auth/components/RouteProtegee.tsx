import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../hooks';

/**
 * Garde de route : affiche les enfants seulement si l'utilisateur est connecté.
 * Sinon → /connexion, en mémorisant la page demandée pour y revenir après la connexion.
 * Rappel : c'est du CONFORT. La vraie protection est côté API (RequireAuthorization → 401).
 */
export function RouteProtegee({ children }: { children: ReactNode }) {
  const { data: utilisateur, isPending, isError, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <p aria-busy="true">Vérification de la session…</p>;

  if (isError) {
    return (
      <div role="alert" className="encart encart--erreur">
        Impossible de vérifier la session.{' '}
        <button type="button" onClick={() => void refetch()}>
          Réessayer
        </button>
      </div>
    );
  }

  if (!utilisateur) {
    return <Navigate to="/connexion" replace state={{ retour: location.pathname + location.search }} />;
  }

  return children;
}
