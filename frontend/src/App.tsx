import { lazy } from 'react';
import { Link, Navigate, type RouteObject } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { Layout } from './components/Layout';
import { ListeNaissancesPage } from './features/naissances/pages/ListeNaissancesPage';
import { DetailNaissancePage } from './features/naissances/pages/DetailNaissancePage';

// Code splitting : le formulaire (et Zod/RHF) n'est téléchargé qu'à la 1re visite de la page.
const NouvelleNaissancePage = lazy(() => import('./features/naissances/pages/NouvelleNaissancePage'));

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/naissances" replace /> },
      { path: 'naissances', element: <ListeNaissancesPage /> },
      { path: 'naissances/nouvelle', element: <NouvelleNaissancePage /> },
      { path: 'naissances/:id', element: <DetailNaissancePage /> },
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

export function creerQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Inutile de réessayer une erreur 4xx (404, 422…) : elle se reproduira.
        retry: (nbEchecs, erreur) =>
          !(erreur instanceof ApiError && erreur.status < 500) && nbEchecs < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
