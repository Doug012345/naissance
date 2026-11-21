import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { Champ } from '../../../components/Champ';
import { useMotDePasseOublie } from '../hooks';
import { schemaMotDePasseOublie, type MotDePasseOublieValeurs } from '../schema';

/**
 * Page PUBLIQUE : l'agent saisit son courriel et reçoit un lien de réinitialisation.
 * Le message de confirmation est le même que le compte existe ou non (on ne révèle pas les comptes).
 */
export default function MotDePasseOubliePage() {
  const { mutateAsync } = useMotDePasseOublie();
  const [envoyeA, setEnvoyeA] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MotDePasseOublieValeurs>({
    resolver: zodResolver(schemaMotDePasseOublie),
    defaultValues: { courriel: '' },
  });

  const soumettre = handleSubmit(async ({ courriel }) => {
    try {
      await mutateAsync(courriel);
      setEnvoyeA(courriel);
    } catch (e) {
      setError('root.serveur', {
        message:
          e instanceof ApiError && e.status === 429
            ? 'Trop de demandes en peu de temps. Réessayez dans 15 minutes.'
            : 'Envoi impossible pour le moment, réessayez.',
      });
    }
  });

  return (
    <main id="contenu" className="contenu contenu--etroit">
      <section aria-labelledby="titre-oubli" className="carte">
        <h1 id="titre-oubli">Mot de passe oublié</h1>

        {envoyeA ? (
          <div role="status" className="encart encart--succes">
            <p>
              Si un compte existe pour <strong>{envoyeA}</strong>, un courriel contenant un lien de
              réinitialisation vient d’être envoyé. Le lien est valable 30 minutes.
            </p>
            <p>Pensez à vérifier vos courriels indésirables.</p>
          </div>
        ) : (
          <>
            <p className="intro">
              Saisissez le courriel de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.
            </p>
            <form onSubmit={soumettre} noValidate className="formulaire pile">
              <div aria-live="assertive">
                {errors.root?.serveur && (
                  <p role="alert" className="encart encart--erreur">
                    {errors.root.serveur.message}
                  </p>
                )}
              </div>

              <Champ label="Courriel" requis erreur={errors.courriel?.message}>
                {(a11y) => (
                  <input type="email" autoComplete="username" autoFocus {...a11y} {...register('courriel')} />
                )}
              </Champ>

              <div className="actions">
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </div>
            </form>
          </>
        )}

        <p>
          <Link to="/connexion">← Retour à la connexion</Link>
        </p>
      </section>
    </main>
  );
}
