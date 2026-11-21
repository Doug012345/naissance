import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { Champ } from '../../../components/Champ';
import { ChampMotDePasse } from '../../../components/ChampMotDePasse';
import { useReinitialiserMotDePasse } from '../hooks';
import { aideMotDePasse, schemaReinitialisation, type ReinitialisationValeurs } from '../schema';

/**
 * Cible du lien reçu par courriel : /reinitialiser-mot-de-passe#id=…&jeton=…
 * Le jeton est dans le fragment (#) : il n'est jamais envoyé au serveur web ni journalisé.
 * On le lit une fois, puis on l'efface de la barre d'adresse (et donc de l'historique).
 */
function lireLien(hash: string): { id: string; jeton: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const id = params.get('id');
  const jeton = params.get('jeton');
  return id && jeton ? { id, jeton } : null;
}

export default function ReinitialisationPage() {
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  const [lien] = useState(() => lireLien(hash));
  useEffect(() => {
    if (hash) void navigate(pathname, { replace: true });
  }, [hash, pathname, navigate]);
  const [lienInvalide, setLienInvalide] = useState(lien === null);
  const [succes, setSucces] = useState(false);
  const { mutateAsync } = useReinitialiserMotDePasse();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReinitialisationValeurs>({
    resolver: zodResolver(schemaReinitialisation),
    defaultValues: { nouveauMotDePasse: '', confirmation: '' },
    mode: 'onTouched',
  });

  const soumettre = handleSubmit(async ({ nouveauMotDePasse }) => {
    if (!lien) return;
    try {
      await mutateAsync({ utilisateurId: lien.id, jeton: lien.jeton, nouveauMotDePasse });
      reset({ nouveauMotDePasse: '', confirmation: '' });
      setSucces(true);
    } catch (e) {
      if (e instanceof ApiError && e.isValidation) {
        if (e.fieldErrors.jeton) return setLienInvalide(true);
        if (e.fieldErrors.nouveauMotDePasse) {
          return setError('nouveauMotDePasse', { message: e.fieldErrors.nouveauMotDePasse }, { shouldFocus: true });
        }
      }
      setError('root.serveur', {
        message:
          e instanceof ApiError && e.status === 429
            ? 'Trop de tentatives. Réessayez dans une minute.'
            : 'Réinitialisation impossible pour le moment, réessayez.',
      });
    }
  });

  let contenu;
  if (succes) {
    contenu = (
      <div role="status" className="encart encart--succes">
        <p>Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.</p>
        <p>
          <Link to="/connexion">Se connecter</Link>
        </p>
      </div>
    );
  } else if (lienInvalide) {
    contenu = (
      <div role="alert" className="encart encart--erreur">
        <p>Ce lien n’est plus valide (expiré, déjà utilisé ou incomplet).</p>
        <p>
          <Link to="/mot-de-passe-oublie">Faire une nouvelle demande</Link>
        </p>
      </div>
    );
  } else {
    contenu = (
      <form onSubmit={soumettre} noValidate className="formulaire pile">
        <div aria-live="assertive">
          {errors.root?.serveur && (
            <p role="alert" className="encart encart--erreur">
              {errors.root.serveur.message}
            </p>
          )}
        </div>

        <Champ label="Nouveau mot de passe" requis aide={aideMotDePasse} erreur={errors.nouveauMotDePasse?.message}>
          {(a11y) => (
            <ChampMotDePasse autoComplete="new-password" autoFocus {...a11y} {...register('nouveauMotDePasse')} />
          )}
        </Champ>

        <Champ label="Confirmer le nouveau mot de passe" requis erreur={errors.confirmation?.message}>
          {(a11y) => <ChampMotDePasse autoComplete="new-password" {...a11y} {...register('confirmation')} />}
        </Champ>

        <div className="actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <main id="contenu" className="contenu contenu--etroit">
      <section aria-labelledby="titre-reinit" className="carte">
        <h1 id="titre-reinit">Choisir un nouveau mot de passe</h1>
        {contenu}
      </section>
    </main>
  );
}
