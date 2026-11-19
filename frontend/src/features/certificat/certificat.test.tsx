import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { renderApp } from '../../test/utils';

const urlLea = '/naissances/11111111-1111-1111-1111-111111111111';

describe('Certificat imprimable', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('est accessible depuis la fiche', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(urlLea);
    await user.click(await screen.findByRole('link', { name: /Certificat à imprimer/ }));
    expect(router.state.location.pathname).toBe(`${urlLea}/certificat`);
  });

  it('affiche « Commune de … », le sceau, le code et le QR code', async () => {
    renderApp(`${urlLea}/certificat`);
    const certificat = await screen.findByRole('article', { name: /Certificat de naissance/ });

    expect(within(certificat).getByText('Commune de Montréal')).toBeInTheDocument();
    expect(within(certificat).getByRole('img', { name: /Sceau : COMMUNE DE MONTRÉAL/ })).toBeInTheDocument();
    expect(within(certificat).getByText('K7QF-9M2X')).toBeInTheDocument();
    expect(within(certificat).getByText('QR code de vérification')).toBeInTheDocument();
    expect(within(certificat).getByText(/attribué à l’impression/)).toBeInTheDocument();
    expect(within(certificat).queryByText('ANNULÉ')).not.toBeInTheDocument();
  });

  it('journalise une copie numérotée puis ouvre l’impression', async () => {
    const user = userEvent.setup();
    renderApp(`${urlLea}/certificat`);

    await user.click(await screen.findByRole('button', { name: /Imprimer le certificat/ }));
    expect(await screen.findByText('Copie n° 1')).toBeInTheDocument();
    expect(screen.getByText(/Réf. agent : agent@exemple.ca/)).toBeInTheDocument();
    expect(window.print).toHaveBeenCalledTimes(1);

    // Chaque nouvelle impression = une nouvelle copie.
    await user.click(screen.getByRole('button', { name: /Imprimer le certificat/ }));
    expect(await screen.findByText('Copie n° 2')).toBeInTheDocument();
    expect(window.print).toHaveBeenCalledTimes(2);
  });

  it('n’imprime pas si la copie n’a pas pu être journalisée', async () => {
    server.use(
      http.post('/api/naissances/:id/delivrances', () => HttpResponse.json({ title: 'Panne' }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderApp(`${urlLea}/certificat`);

    await user.click(await screen.findByRole('button', { name: /Imprimer le certificat/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Impossible de préparer l’impression/);
    expect(window.print).not.toHaveBeenCalled();
  });

  it('porte le filigrane « ANNULÉ » pour un acte annulé', async () => {
    server.use(
      http.get('/api/naissances/:id', () =>
        HttpResponse.json({
          id: '11111111-1111-1111-1111-111111111111', numeroActe: 'N-2026-000001', prenom: 'Léa', nom: 'TREMBLAY',
          sexe: 'Feminin', dateHeureNaissance: '2026-11-10T08:30:00', etablissement: 'CHU', ville: 'Montréal',
          commune: 'Montréal', codeVerification: 'K7QF9M2X', poidsGrammes: 3400, tailleCm: 50,
          mere: { prenom: 'Marie', nom: 'TREMBLAY', dateNaissance: '1994-03-02' }, secondParent: null,
          statut: 'Annulee', motifAnnulation: 'Doublon de saisie', dateEnregistrementUtc: '2026-11-10T15:00:00',
          version: 'x',
        }),
      ),
    );
    renderApp(`${urlLea}/certificat`);
    expect(await screen.findByRole('note', { name: 'Acte annulé' })).toHaveTextContent('ANNULÉ');
  });
});

describe('Vérification publique (cible du QR code)', () => {
  it('fonctionne SANS être connecté et confirme un certificat authentique', async () => {
    server.use(http.get('/api/auth/moi', () => HttpResponse.json({ status: 401 }, { status: 401 })));
    renderApp('/verifier/k7qf-9m2x');

    expect(await screen.findByRole('heading', { name: /Certificat authentique/ })).toBeInTheDocument();
    expect(screen.getByText('N-2026-000001')).toBeInTheDocument();
    expect(screen.getByText('L. T.')).toBeInTheDocument();
    // Aucune donnée personnelle complète : ni le prénom, ni la mère.
    expect(screen.queryByText(/Léa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Marie/)).not.toBeInTheDocument();
  });

  it('signale un code inconnu', async () => {
    renderApp('/verifier/ZZZZ-ZZZZ');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Aucun acte ne correspond/);
  });

  it('permet de saisir le code à la main', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/verifier');
    await user.type(screen.getByLabelText('Code de vérification', { exact: true }), 'k7qf-9m2x');
    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(router.state.location.pathname).toBe('/verifier/K7QF-9M2X');
    expect(await screen.findByRole('heading', { name: /Certificat authentique/ })).toBeInTheDocument();
  });

  it('signale un acte annulé', async () => {
    server.use(
      http.get('/api/verification/:code', () =>
        HttpResponse.json({
          numeroActe: 'N-2026-000001', initialesEnfant: 'L. T.', dateNaissance: '2026-11-10',
          commune: 'Montréal', statut: 'Annulee', dateEnregistrementUtc: '2026-11-10T15:00:00',
        }),
      ),
    );
    renderApp('/verifier/K7QF-9M2X');
    expect(await screen.findByRole('heading', { name: /ANNULÉ/ })).toBeInTheDocument();
  });

  it('explique la limite de requêtes (429)', async () => {
    server.use(http.get('/api/verification/:code', () => new HttpResponse(null, { status: 429 })));
    renderApp('/verifier/K7QF-9M2X');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Trop de vérifications/);
  });
});
