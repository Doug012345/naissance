import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/setup';
import { renderApp } from '../../../test/utils';

const urlLea = '/naissances/11111111-1111-1111-1111-111111111111';

describe('Rectification d’un acte', () => {
  it('ouvre le formulaire prérempli depuis la fiche', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(urlLea);

    await user.click(await screen.findByRole('link', { name: /Rectifier/ }));

    expect(router.state.location.pathname).toBe(`${urlLea}/rectifier`);
    expect(await screen.findByLabelText(/^Prénom \*$/)).toHaveValue('Léa');
    expect(screen.getByLabelText(/^Commune/)).toHaveValue('Montréal');
    expect(screen.getByLabelText(/Date et heure/)).toHaveValue('2026-11-10T08:30');
    expect(screen.getByRole('button', { name: 'Enregistrer la rectification' })).toBeInTheDocument();
  });

  it('enregistre la rectification, affiche l’historique avant → après et le nouveau code', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`${urlLea}/rectifier`);

    const prenom = await screen.findByLabelText(/^Prénom \*$/);
    await user.clear(prenom);
    await user.type(prenom, 'Léana');
    await user.type(screen.getByLabelText(/Motif de la rectification/), 'Erreur de saisie du prénom');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la rectification' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Acte rectifié');
    expect(router.state.location.pathname).toBe(urlLea);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Léana TREMBLAY');
    expect(screen.getByText('NEUF-2345')).toBeInTheDocument(); // nouveau code de vérification

    const historique = await screen.findByRole('region', { name: 'Historique des rectifications' });
    expect(await within(historique).findByText(/Erreur de saisie du prénom/)).toBeInTheDocument();
    expect(within(historique).getByText('Léa')).toBeInTheDocument();
    expect(within(historique).getByText('Léana')).toBeInTheDocument();
  });

  it('exige un motif d’au moins 10 caractères (aucune requête sinon)', async () => {
    let appele = false;
    server.use(
      http.post('/api/naissances/:id/rectifications', () => {
        appele = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp(`${urlLea}/rectifier`);

    await user.type(await screen.findByLabelText(/Motif de la rectification/), 'Erreur');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la rectification' }));

    expect(await screen.findByText('Le motif doit contenir au moins 10 caractères.')).toBeInTheDocument();
    expect(appele).toBe(false);
  });

  it('refuse une date de naissance postérieure à l’enregistrement de l’acte', async () => {
    const user = userEvent.setup();
    renderApp(`${urlLea}/rectifier`);

    const date = await screen.findByLabelText(/Date et heure/);
    await user.clear(date);
    await user.type(date, '2026-11-11T08:30');
    await user.type(screen.getByLabelText(/Motif de la rectification/), 'Erreur de saisie de la date');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la rectification' }));

    expect(await screen.findByText(/postérieure à l’enregistrement/)).toBeInTheDocument();
  });

  it('explique le conflit si quelqu’un a modifié l’acte entre-temps (409)', async () => {
    server.use(
      http.post('/api/naissances/:id/rectifications', () =>
        HttpResponse.json({ status: 409, title: 'Conflit' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp(`${urlLea}/rectifier`);

    const ville = await screen.findByLabelText(/^Ville/);
    await user.clear(ville);
    await user.type(ville, 'Laval');
    await user.type(screen.getByLabelText(/Motif de la rectification/), 'Erreur de saisie de la ville');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la rectification' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/modifié cet acte entre-temps/);
  });

  it('n’est pas proposée pour un acte annulé', async () => {
    const user = userEvent.setup();
    renderApp(urlLea);

    await user.click(await screen.findByRole('button', { name: /Annuler cette déclaration/ }));
    await user.type(screen.getByLabelText(/Motif/), 'Doublon de saisie constaté');
    await user.click(screen.getByRole('button', { name: /Confirmer/ }));

    expect(await screen.findByText('Annulée')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Rectifier/ })).not.toBeInTheDocument();
  });
});
