import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { creerQueryClient, routes } from './App';
import './styles.css';

// Après un déploiement, un onglet resté ouvert réclame d'anciens fichiers JS (noms hachés) qui
// n'existent plus → « Failed to fetch dynamically imported module ». On recharge la page UNE fois
// pour récupérer la nouvelle version (garde-fou de 10 s contre une boucle de rechargement).
window.addEventListener('vite:preloadError', (evenement) => {
  const cle = 'rechargement-nouvelle-version';
  try {
    const dernier = Number(sessionStorage.getItem(cle) ?? 0);
    if (Date.now() - dernier < 10_000) return; // déjà tenté : on laisse l'erreur s'afficher
    sessionStorage.setItem(cle, String(Date.now()));
  } catch {
    // sessionStorage indisponible : on recharge quand même
  }
  evenement.preventDefault();
  window.location.reload();
});

const queryClient = creerQueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  // StrictMode : en dev, double-exécute rendus/effets pour révéler les effets impurs.
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
