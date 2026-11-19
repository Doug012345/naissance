import { lazy, Suspense } from 'react';
import { Link, Navigate, type RouteObject } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { Layout } from './components/Layout';
import { RouteProtegee } from './features/auth/components/RouteProtegee';
import { sessionKey } from './features/auth/hooks';
import { ListeNaissancesPage } from './features/naissances/pages/ListeNaissancesPage';
import { DetailNaissancePage } from './features/naissances/pages/DetailNaissancePage';

// Code splitting : les formulaires (et Zod/RHF) ne sont téléchargés qu'à la 1re visite de la page.
const NouvelleNaissancePage = lazy(() => import('./features/naissances/pages/NouvelleNaissancePage'));
const ConnexionPage = lazy(() => import('./features/auth/pages/ConnexionPage'));
const MotDePassePage = lazy(() => import('./features/auth/pages/MotDePassePage'));
const CertificatPage = lazy(() => import('./features/certificat/pages/CertificatPage'));
const VerificationPage = lazy(() => import('./features/certificat/pages/VerificationPage'));

const verification = (
  <Suspense fallback={<p aria-busy="true">Chargement…</p>}>
    <VerificationPage />
  </Suspense>
);

export const routes: RouteObject[] = [
  // Page PUBLIQUE (cible du QR code imprimé sur le certificat) : aucune connexion requise.
  { path: 'verifier', element: verification },
  { path: 'verifier/:code', element: verification },
  {
    path: 'connexion',
    element: (
      <Suspense fallback={<p aria-busy="true">Chargement…</p>}>
        <ConnexionPage />
      </Suspense>
    ),
  },
  {
    // Tout ce qui est sous le Layout exige d'être connecté.
    element: (
      <RouteProtegee>
        <Layout />
      </RouteProtegee>
    ),
    children: [
      { index: true, element: <Navigate to="/naissances" replace /> },
      { path: 'naissances', element: <ListeNaissancesPage /> },
      { path: 'naissances/nouvelle', element: <NouvelleNaissancePage /> },
      { path: 'naissances/:id', element: <DetailNaissancePage /> },
      { path: 'naissances/:id/certificat', element: <CertificatPage /> },
      { path: 'compte/mot-de-passe', element: <MotDePassePage /> },
      {
        path: '*',
        element: (
          <p>
            Page introuvable. <Link to="/naissances">Retour</Link>
          </p>
        ),
      },
    ],
  },
];

export function creerQueryClient({ reessayer = true }: { reessayer?: boolean } = {}) {
  // Un 401 n'importe où (session expirée, cookie supprimé…) → session = null
  // → RouteProtegee redirige vers /connexion.
  const surErreur = (erreur: unknown) => {
    if (erreur instanceof ApiError && erreur.status === 401) client.setQueryData(sessionKey, null);
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: surErreur }),
    mutationCache: new MutationCache({ onError: surErreur }),
    defaultOptions: {
      queries: {
        // Inutile de réessayer une erreur 4xx (404, 422…) : elle se reproduira.
        retry: reessayer
          ? (nbEchecs, erreur) => !(erreur instanceof ApiError && erreur.status < 500) && nbEchecs < 2
          : false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
  return client;
}
