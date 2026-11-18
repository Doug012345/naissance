import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { creerQueryClient, routes } from './App';
import './styles.css';

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
