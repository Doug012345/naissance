import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { Champ } from '../../../components/Champ';
import { ChampMotDePasse } from '../../../components/ChampMotDePasse';
import { useConnexion, useSession } from '../hooks';
import { schemaConnexion, type ConnexionValeurs } from '../schema';

export default function ConnexionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const retour = (location.state as { retour?: string } | null)?.retour ?? '/naissances';
  const { data: utilisateur } = useSession();
  const { mutateAsync } = useConnexion();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConnexionValeurs>({
    resolver: zodResolver(schemaConnexion),
    defaultValues: { courriel: '', motDePasse: '' },
  });

  // Déjà connecté (ex. retour arrière) : inutile de rester ici.
  if (utilisateur) return <Navigate to={retour} replace />;

  const soumettre = handleSubmit(async ({ courriel, motDePasse }) => {
    try {
      await mutateAsync({ courriel, motDePasse });
      navigate(retour, { replace: true });
    } catch (e) {
      setError('root.serveur', {
        message:
          e instanceof ApiError && e.status === 401
            ? e.message
            : 'Connexion impossible pour le moment, réessayez.',
      });
    }
  });

  return (
    <main id="contenu" className="contenu contenu--etroit">
      <section aria-labelledby="titre-connexion" className="carte">
        <h1 id="titre-connexion">Connexion</h1>
        <p className="intro">Registre des naissances — accès réservé aux agents.</p>

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

          <Champ label="Mot de passe" requis erreur={errors.motDePasse?.message}>
            {(a11y) => (
              <ChampMotDePasse autoComplete="current-password" {...a11y} {...register('motDePasse')} />
            )}
          </Champ>

          <div className="actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </div>
        </form>

        <p>
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>
      </section>
    </main>
  );
}
