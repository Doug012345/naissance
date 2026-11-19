import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '../../../api/client';
import { Champ } from '../../../components/Champ';
import { ChampMotDePasse } from '../../../components/ChampMotDePasse';
import { useChangerMotDePasse } from '../hooks';
import {
  aideMotDePasse,
  schemaChangementMotDePasse,
  type ChangementMotDePasseValeurs,
} from '../schema';

const vide: ChangementMotDePasseValeurs = { motDePasseActuel: '', nouveauMotDePasse: '', confirmation: '' };

export default function MotDePassePage() {
  const { mutateAsync } = useChangerMotDePasse();
  const [succes, setSucces] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangementMotDePasseValeurs>({
    resolver: zodResolver(schemaChangementMotDePasse),
    defaultValues: vide,
    mode: 'onTouched',
  });

  const soumettre = handleSubmit(async ({ motDePasseActuel, nouveauMotDePasse }) => {
    setSucces(false);
    try {
      await mutateAsync({ motDePasseActuel, nouveauMotDePasse });
      reset(vide); // on ne garde jamais un mot de passe affiché après usage
      setSucces(true);
    } catch (e) {
      // 422 → erreur sous le champ visé par le serveur (motDePasseActuel / nouveauMotDePasse).
      if (e instanceof ApiError && e.isValidation && Object.keys(e.fieldErrors).length > 0) {
        for (const [champ, message] of Object.entries(e.fieldErrors)) {
          if (champ === 'motDePasseActuel' || champ === 'nouveauMotDePasse') {
            setError(champ, { message }, { shouldFocus: true });
          } else {
            setError('root.serveur', { message });
          }
        }
        return;
      }
      setError('root.serveur', {
        message: e instanceof Error ? e.message : 'Erreur inattendue, réessayez.',
      });
    }
  });

  return (
    <section aria-labelledby="titre-mdp" className="contenu--etroit">
      <h1 id="titre-mdp">Modifier mon mot de passe</h1>

      <div aria-live="polite">
        {succes && (
          <p role="status" className="encart encart--succes">
            Mot de passe modifié avec succès.
          </p>
        )}
        {errors.root?.serveur && (
          <p role="alert" className="encart encart--erreur">
            {errors.root.serveur.message}
          </p>
        )}
      </div>

      <form onSubmit={soumettre} noValidate className="formulaire pile carte">
        <Champ label="Mot de passe actuel" requis erreur={errors.motDePasseActuel?.message}>
          {(a11y) => (
            <ChampMotDePasse autoComplete="current-password" {...a11y} {...register('motDePasseActuel')} />
          )}
        </Champ>

        <Champ
          label="Nouveau mot de passe"
          requis
          aide={aideMotDePasse}
          erreur={errors.nouveauMotDePasse?.message}
        >
          {(a11y) => (
            <ChampMotDePasse autoComplete="new-password" {...a11y} {...register('nouveauMotDePasse')} />
          )}
        </Champ>

        <Champ label="Confirmer le nouveau mot de passe" requis erreur={errors.confirmation?.message}>
          {(a11y) => (
            <ChampMotDePasse autoComplete="new-password" {...a11y} {...register('confirmation')} />
          )}
        </Champ>

        <div className="actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement…' : 'Modifier le mot de passe'}
          </button>
        </div>
      </form>
    </section>
  );
}
