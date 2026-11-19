import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../test/setup';
import { renderApp } from '../../../test/utils';

describe('Liste des naissances', () => {
  it('affiche les naissances renvoyées par l’API', async () => {
    renderApp('/naissances');

    // (la session est d'abord vérifiée, d'où findBy)
    expect(await screen.findByText(/Chargement des naissances/)).toBeInTheDocument();
    const tableau = await screen.findByRole('table');
    expect(within(tableau).getByText('Léa TREMBLAY')).toBeInTheDocument();
    expect(within(tableau).getByText('Noah GAGNON')).toBeInTheDocument();
    expect(screen.getByText('2 résultats')).toBeInTheDocument();
  });

  it('filtre via la recherche (debounce) et reflète la recherche dans l’URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/naissances');
    await screen.findByRole('table');

    await user.type(screen.getByRole('searchbox', { name: /rechercher/i }), 'noah');

    await waitFor(() => expect(screen.queryByText('Léa TREMBLAY')).not.toBeInTheDocument());
    expect(screen.getByText('Noah GAGNON')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=noah');
  });

  it('lit les filtres depuis l’URL au chargement (lien partageable)', async () => {
    renderApp('/naissances?q=gagnon');
    expect(await screen.findByText('Noah GAGNON')).toBeInTheDocument();
    expect(screen.queryByText('Léa TREMBLAY')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('gagnon');
  });

  it('propose de réessayer si l’API échoue', async () => {
    server.use(http.get('/api/naissances', () => HttpResponse.json({ title: 'Panne' }, { status: 500 })));
    renderApp('/naissances');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Impossible de charger la liste/);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('Détail et annulation', () => {
  const urlLea = '/naissances/11111111-1111-1111-1111-111111111111';

  it('affiche « n’existe pas » pour un id inconnu (404)', async () => {
    renderApp('/naissances/99999999-9999-9999-9999-999999999999');
    expect(await screen.findByText(/n’existe pas/)).toBeInTheDocument();
  });

  it('annule de façon optimiste : le statut change AVANT la réponse du serveur', async () => {
    // Serveur volontairement lent pour observer l'état optimiste.
    server.use(
      http.post('/api/naissances/:id/annulation', async () => {
        await delay(200);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp(urlLea);

    await user.click(await screen.findByRole('button', { name: /Annuler cette déclaration/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Doublon de saisie constaté');
    await user.click(screen.getByRole('button', { name: /Confirmer/ }));

    // Immédiatement « Annulée », alors que le serveur n'a pas encore répondu.
    expect(await screen.findByText('Annulée')).toBeInTheDocument();
    expect(screen.getByText('Doublon de saisie constaté')).toBeInTheDocument();
  });

  it('revient en arrière (rollback) et explique le conflit si le serveur répond 409', async () => {
    server.use(
      http.post('/api/naissances/:id/annulation', () =>
        HttpResponse.json({ status: 409, title: 'Conflit' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp(urlLea);

    await user.click(await screen.findByRole('button', { name: /Annuler cette déclaration/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Doublon de saisie constaté');
    await user.click(screen.getByRole('button', { name: /Confirmer/ }));

    // Après rollback, la déclaration redevient « Enregistrée ».
    await waitFor(() => expect(screen.getByText('Enregistrée')).toBeInTheDocument());
    expect(screen.queryByText('Annulée')).not.toBeInTheDocument();
  });
});

describe('Création', () => {
  it('redirige vers le détail avec un message de succès après l’enregistrement', async () => {
    server.use(
      http.get('/api/naissances/:id', () =>
        HttpResponse.json({
          id: '33333333-3333-3333-3333-333333333333',
          numeroActe: 'N-2026-000003',
          prenom: 'Emma',
          nom: 'ROY',
          sexe: 'Feminin',
          dateHeureNaissance: new Date().toISOString(),
          etablissement: 'CHUM',
          ville: 'Montréal',
          poidsGrammes: 3100,
          tailleCm: 49,
          mere: { prenom: 'Anne', nom: 'ROY', dateNaissance: '1992-05-05' },
          secondParent: null,
          statut: 'Enregistree',
          motifAnnulation: null,
          dateEnregistrementUtc: new Date().toISOString(),
          version: 'AAA=',
        }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/naissances/nouvelle');

    // La page est chargée en lazy → findBy attend la fin du Suspense.
    await user.type(await screen.findByLabelText(/^Prénom \*$/), 'Emma');
    await user.type(screen.getByLabelText(/^Nom \*$/), 'Roy');
    await user.click(screen.getByLabelText('Féminin'));
    const ilYaUneHeure = new Date(Date.now() - 3600_000);
    const local = new Date(ilYaUneHeure.getTime() - ilYaUneHeure.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    await user.type(screen.getByLabelText(/Date et heure/), local);
    await user.type(screen.getByLabelText(/Poids/), '3100');
    await user.type(screen.getByLabelText(/Taille/), '49');
    await user.type(screen.getByLabelText(/Établissement/), 'CHUM');
    await user.type(screen.getByLabelText(/Ville/), 'Montréal');
    await user.type(screen.getByLabelText(/Prénom de la mère/), 'Anne');
    await user.type(screen.getByLabelText(/Nom de la mère/), 'Roy');
    await user.type(screen.getByLabelText(/Date de naissance de la mère/), '1992-05-05');
    await user.click(screen.getByRole('button', { name: /Enregistrer la naissance/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('Naissance enregistrée avec succès.');
    expect(router.state.location.pathname).toBe('/naissances/33333333-3333-3333-3333-333333333333');
  });
});
