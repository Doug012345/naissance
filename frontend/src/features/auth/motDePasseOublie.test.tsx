import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { renderApp } from '../../test/utils';
import { JETON_VALIDE } from '../../test/handlers';

const nonConnecte = () =>
  server.use(http.get('/api/auth/moi', () => HttpResponse.json({ status: 401 }, { status: 401 })));

const lien = (jeton: string) => `/reinitialiser-mot-de-passe#id=u-1&jeton=${jeton}`;

describe('Mot de passe oublié', () => {
  it('est proposé sur la page de connexion', async () => {
    nonConnecte();
    const user = userEvent.setup();
    const { router } = renderApp('/connexion');

    await user.click(await screen.findByRole('link', { name: 'Mot de passe oublié ?' }));
    expect(router.state.location.pathname).toBe('/mot-de-passe-oublie');
    expect(await screen.findByRole('heading', { name: 'Mot de passe oublié' })).toBeInTheDocument();
  });

  it('envoie la demande et affiche un message neutre (ne révèle pas si le compte existe)', async () => {
    nonConnecte();
    let corps: unknown;
    server.use(
      http.post('/api/auth/mot-de-passe-oublie', async ({ request }) => {
        corps = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );
    const user = userEvent.setup();
    renderApp('/mot-de-passe-oublie');

    await user.type(await screen.findByLabelText(/Courriel/), '  inconnu@exemple.ca ');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Si un compte existe pour inconnu@exemple.ca/);
    expect(corps).toEqual({ courriel: 'inconnu@exemple.ca' });
  });

  it('valide le courriel avant d’appeler l’API', async () => {
    nonConnecte();
    const user = userEvent.setup();
    renderApp('/mot-de-passe-oublie');

    await user.type(await screen.findByLabelText(/Courriel/), 'pas-un-courriel');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    expect(await screen.findByText('Courriel invalide.')).toBeInTheDocument();
  });

  it('explique la limite de demandes (429)', async () => {
    nonConnecte();
    server.use(http.post('/api/auth/mot-de-passe-oublie', () => new HttpResponse(null, { status: 429 })));
    const user = userEvent.setup();
    renderApp('/mot-de-passe-oublie');

    await user.type(await screen.findByLabelText(/Courriel/), 'agent@exemple.ca');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Trop de demandes/);
  });
});

describe('Réinitialisation par le lien reçu', () => {
  it('enregistre le nouveau mot de passe et retire le jeton de la barre d’adresse', async () => {
    nonConnecte();
    let corps: unknown;
    server.use(
      http.post('/api/auth/reinitialisation', async ({ request }) => {
        corps = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp(lien(JETON_VALIDE));

    await user.type(await screen.findByLabelText(/^Nouveau mot de passe/), 'Nouveau-MotDePasse2');
    expect(router.state.location.hash).toBe('');
    await user.type(screen.getByLabelText(/^Confirmer/), 'Nouveau-MotDePasse2');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Votre mot de passe a été modifié');
    expect(corps).toEqual({ utilisateurId: 'u-1', jeton: JETON_VALIDE, nouveauMotDePasse: 'Nouveau-MotDePasse2' });
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('applique les règles du mot de passe avant l’envoi', async () => {
    nonConnecte();
    const user = userEvent.setup();
    renderApp(lien(JETON_VALIDE));

    await user.type(await screen.findByLabelText(/^Nouveau mot de passe/), 'court');
    await user.type(screen.getByLabelText(/^Confirmer/), 'autre');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }));

    expect(await screen.findByText('Au moins 10 caractères.')).toBeInTheDocument();
    expect(screen.getByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument();
  });

  it('propose une nouvelle demande si le lien est expiré ou déjà utilisé', async () => {
    nonConnecte();
    const user = userEvent.setup();
    renderApp(lien('perime'));

    await user.type(await screen.findByLabelText(/^Nouveau mot de passe/), 'Nouveau-MotDePasse2');
    await user.type(screen.getByLabelText(/^Confirmer/), 'Nouveau-MotDePasse2');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le nouveau mot de passe' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/n’est plus valide/);
    expect(screen.getByRole('link', { name: 'Faire une nouvelle demande' })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie',
    );
  });

  it('signale un lien incomplet sans même afficher le formulaire', async () => {
    nonConnecte();
    renderApp('/reinitialiser-mot-de-passe');
    expect(await screen.findByRole('alert')).toHaveTextContent(/n’est plus valide/);
    expect(screen.queryByLabelText(/^Nouveau mot de passe/)).not.toBeInTheDocument();
  });
});
