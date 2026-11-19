import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from './ErrorBoundary';
import { useDeconnexion, useSession } from '../features/auth/hooks';

export function Layout() {
  const { pathname } = useLocation();
  const { data: utilisateur } = useSession();
  const deconnexion = useDeconnexion();

  return (
    <>
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <header className="entete">
        <span className="entete__titre">Registre des naissances</span>
        <nav aria-label="Navigation principale">
          <NavLink to="/naissances" end>
            Naissances
          </NavLink>
          <NavLink to="/naissances/nouvelle">Nouvelle déclaration</NavLink>
        </nav>
        <div className="entete__compte">
          <span className="entete__utilisateur">{utilisateur?.courriel}</span>
          <NavLink to="/compte/mot-de-passe">Mot de passe</NavLink>
          <button
            type="button"
            className="bouton-lien"
            onClick={() => deconnexion.mutate()}
            disabled={deconnexion.isPending}
          >
            Se déconnecter
          </button>
        </div>
      </header>

      <main id="contenu" className="contenu">
        {/* QueryErrorResetBoundary : « Réessayer » relance aussi les requêtes en erreur. */}
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary resetKey={pathname} onReset={reset}>
              {/* Suspense : affiché pendant le chargement des pages lazy (code splitting). */}
              <Suspense fallback={<p aria-busy="true">Chargement…</p>}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </main>
    </>
  );
}
