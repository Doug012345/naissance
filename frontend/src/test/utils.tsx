import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { creerQueryClient, routes } from '../App';

/** Monte l'application complète (routeur + cache neuf) sur une URL donnée. */
export function renderApp(url: string) {
  // Même client qu'en prod (gestion globale des 401), sans les nouvelles tentatives.
  const queryClient = creerQueryClient({ reessayer: false });
  const router = createMemoryRouter(routes, { initialEntries: [url] });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
