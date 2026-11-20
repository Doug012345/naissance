import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../../api/client';
import { NaissanceForm } from './NaissanceForm';

const maintenant = () => new Date('2026-11-18T12:00:00');

async function remplirFormulaireValide(user: ReturnType<typeof userEvent.setup>) {
  // On cible par LIBELLÉ accessible, comme un utilisateur (et un lecteur d'écran).
  await user.type(screen.getByLabelText(/^Prénom \*$/), 'Léa');
  await user.type(screen.getByLabelText(/^Nom \*$/), 'Tremblay');
  await user.click(screen.getByLabelText('Féminin'));
  await user.type(screen.getByLabelText(/Date et heure/), '2026-11-18T08:30');
  await user.type(screen.getByLabelText(/Poids/), '3400');
  await user.type(screen.getByLabelText(/Taille/), '50.5');
  await user.type(screen.getByLabelText(/Établissement/), 'CHU Sainte-Justine');
  await user.type(screen.getByLabelText(/Ville/), 'Montréal');
  await user.type(screen.getByLabelText(/^Commune/), 'Montréal');
  await user.type(screen.getByLabelText(/Prénom de la mère/), 'Marie');
  await user.type(screen.getByLabelText(/Nom de la mère/), 'Tremblay');
  await user.type(screen.getByLabelText(/Date de naissance de la mère/), '1994-03-02');
}

describe('<NaissanceForm />', () => {
  it('affiche les erreurs sous les champs et n’appelle pas l’API si le formulaire est vide', async () => {
    const user = userEvent.setup();
    const onSoumettre = vi.fn();
    render(<NaissanceForm onSoumettre={onSoumettre} maintenant={maintenant} />);

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(await screen.findByText('Le prénom est obligatoire.')).toBeInTheDocument();
    expect(screen.getByText('Le poids est obligatoire.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Prénom \*$/)).toHaveAttribute('aria-invalid', 'true');
    // RHF déplace le focus vers un champ en erreur (accessibilité clavier).
    expect(document.activeElement?.tagName).toBe('INPUT');
    expect(onSoumettre).not.toHaveBeenCalled();
  });

  it('envoie une requête conforme au contrat de l’API', async () => {
    const user = userEvent.setup();
    const onSoumettre = vi.fn().mockResolvedValue(undefined);
    render(<NaissanceForm onSoumettre={onSoumettre} maintenant={maintenant} />);

    await remplirFormulaireValide(user);
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(onSoumettre).toHaveBeenCalledWith(
      expect.objectContaining({
        prenom: 'Léa',
        sexe: 'Feminin',
        commune: 'Montréal',
        poidsGrammes: 3400,
        tailleCm: 50.5,
        secondParent: null,
      }),
      '', // pas de motif en création
    );
  });

  it('affiche les champs du second parent uniquement si la case est cochée', async () => {
    const user = userEvent.setup();
    render(<NaissanceForm onSoumettre={vi.fn()} maintenant={maintenant} />);

    expect(screen.queryByLabelText(/Prénom du second parent/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Déclarer un second parent/));
    expect(screen.getByLabelText(/Prénom du second parent/)).toBeInTheDocument();
  });

  it('place l’erreur 422 du serveur sous le bon champ', async () => {
    const user = userEvent.setup();
    const onSoumettre = vi.fn().mockRejectedValue(
      new ApiError(422, {
        status: 422,
        detail: 'Le poids doit être entre 300 g et 7 000 g.',
        errors: { poidsGrammes: ['Le poids doit être entre 300 g et 7 000 g.'] },
      }),
    );
    render(<NaissanceForm onSoumettre={onSoumettre} maintenant={maintenant} />);

    await remplirFormulaireValide(user);
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    expect(await screen.findByText('Le poids doit être entre 300 g et 7 000 g.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Poids/)).toHaveAttribute('aria-invalid', 'true');
  });
});
