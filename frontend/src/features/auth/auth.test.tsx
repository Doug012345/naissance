import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { renderApp } from '../../test/utils';
import { MOT_DE_PASSE_TEST, utilisateurTest } from '../../test/handlers';
import { schemaChangementMotDePasse } from './schema';

const nonConnecte = () =>
  server.use(http.get('/api/auth/moi', () => HttpResponse.json({ status: 401 }, { status: 401 })));

describe('Connexion', () => {
  it('redirige vers /connexion puis revient à la page demandée après connexion', async () => {
    nonConnecte();
    const user = userEvent.setup();
    const { router } = renderApp('/naissances/nouvelle');

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');

    await user.type(screen.getByLabelText(/Courriel/), utilisateurTest.courriel);
    await user.type(screen.getByLabelText(/^Mot de passe/), MOT_DE_PASSE_TEST);
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('heading', { name: 'Déclarer une naissance' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/naissances/nouvelle');
    expect(screen.getByText(utilisateurTest.courriel)).toBeInTheDocument();
  });

  it('affiche le message du serveur si les identifiants sont invalides', async () => {
    nonConnecte();
    const user = userEvent.setup();
    renderApp('/connexion');

    await user.type(await screen.findByLabelText(/Courriel/), utilisateurTest.courriel);
    await user.type(screen.getByLabelText(/^Mot de passe/), 'mauvais');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Courriel ou mot de passe invalide.');
  });

  it('valide le formulaire avant d’appeler l’API', async () => {
    nonConnecte();
    const user = userEvent.setup();
    renderApp('/connexion');

    await user.type(await screen.findByLabelText(/Courriel/), 'pas-un-courriel');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Courriel invalide.')).toBeInTheDocument();
    expect(screen.getByText('Le mot de passe est obligatoire.')).toBeInTheDocument();
  });

  it('l’œil affiche puis masque le mot de passe', async () => {
    nonConnecte();
    const user = userEvent.setup();
    renderApp('/connexion');

    const champ = await screen.findByLabelText(/^Mot de passe/);
    const oeil = screen.getByRole('button', { name: 'Afficher le mot de passe' });
    expect(champ).toHaveAttribute('type', 'password');
    expect(oeil).toHaveAttribute('aria-pressed', 'false');

    await user.click(oeil);
    expect(champ).toHaveAttribute('type', 'text');
    expect(oeil).toHaveAttribute('aria-pressed', 'true');

    await user.click(oeil);
    expect(champ).toHaveAttribute('type', 'password');
  });

  it('se déconnecte et revient à l’écran de connexion', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/naissances');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/connexion');
  });

  it('renvoie vers la connexion si l’API répond 401 (session expirée)', async () => {
    server.use(
      http.get('/api/naissances', () => HttpResponse.json({ status: 401 }, { status: 401 })),
    );
    renderApp('/naissances');
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
  });
});

describe('Changement de mot de passe', () => {
  const NOUVEAU = 'Nouveau-MotDePasse2';

  it('modifie le mot de passe et vide le formulaire', async () => {
    const user = userEvent.setup();
    renderApp('/compte/mot-de-passe');

    await user.type(await screen.findByLabelText(/^Mot de passe actuel/), MOT_DE_PASSE_TEST);
    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), NOUVEAU);
    await user.type(screen.getByLabelText(/^Confirmer/), NOUVEAU);
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Mot de passe modifié avec succès.');
    expect(screen.getByLabelText(/^Mot de passe actuel/)).toHaveValue('');
  });

  it('affiche l’erreur 422 du serveur sous « Mot de passe actuel »', async () => {
    const user = userEvent.setup();
    renderApp('/compte/mot-de-passe');

    await user.type(await screen.findByLabelText(/^Mot de passe actuel/), 'Faux-MotDePasse9');
    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), NOUVEAU);
    await user.type(screen.getByLabelText(/^Confirmer/), NOUVEAU);
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByText('Le mot de passe actuel est incorrect.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/^Mot de passe actuel/)).toHaveFocus());
  });

  it('refuse une confirmation différente', async () => {
    const user = userEvent.setup();
    renderApp('/compte/mot-de-passe');

    await user.type(await screen.findByLabelText(/^Mot de passe actuel/), MOT_DE_PASSE_TEST);
    await user.type(screen.getByLabelText(/^Nouveau mot de passe/), NOUVEAU);
    await user.type(screen.getByLabelText(/^Confirmer/), `${NOUVEAU}x`);
    await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));

    expect(await screen.findByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument();
  });
});

describe('Règles du nouveau mot de passe (Zod)', () => {
  const verifier = (nouveau: string) =>
    schemaChangementMotDePasse.safeParse({
      motDePasseActuel: MOT_DE_PASSE_TEST,
      nouveauMotDePasse: nouveau,
      confirmation: nouveau,
    });

  it.each([
    ['Court-1', 'Au moins 10 caractères.'],
    ['sans-majuscule-1', 'Au moins une majuscule.'],
    ['SANS-MINUSCULE-1', 'Au moins une minuscule.'],
    ['Sans-Chiffre-Ici', 'Au moins un chiffre.'],
    ['SansSpecial123', 'Au moins un caractère spécial.'],
    [MOT_DE_PASSE_TEST, 'Le nouveau mot de passe doit être différent de l’actuel.'],
  ])('« %s » → %s', (nouveau, message) => {
    const r = verifier(nouveau);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain(message);
  });

  it('accepte un mot de passe robuste', () => {
    expect(verifier('Robuste-MotDePasse7').success).toBe(true);
  });
});
