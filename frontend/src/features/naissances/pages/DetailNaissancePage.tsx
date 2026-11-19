import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { formaterCode, libellesSexe, type NaissanceDetail } from '../../../api/naissances';
import { useAnnulerNaissance, useNaissance } from '../hooks';
import { formatDate, formatDateHeure, StatutBadge } from '../components/StatutBadge';

export function DetailNaissancePage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const messageFlash = (location.state as { message?: string } | null)?.message;

  const { data: n, isPending, isError, error, refetch } = useNaissance(id);

  if (isPending) return <p aria-busy="true">Chargement…</p>;

  if (isError) {
    const introuvable = error instanceof ApiError && error.isNotFound;
    return (
      <div role="alert" className="encart encart--erreur">
        <p>{introuvable ? 'Cette naissance n’existe pas.' : `Erreur : ${error.message}`}</p>
        {!introuvable && (
          <button type="button" onClick={() => refetch()}>
            Réessayer
          </button>
        )}
        <Link to="/naissances">Retour à la liste</Link>
      </div>
    );
  }

  return (
    <article aria-labelledby="titre-detail">
      {messageFlash && (
        <p role="status" className="encart encart--succes">
          {messageFlash}
        </p>
      )}

      <div className="titre-ligne">
        <h1 id="titre-detail">
          {n.prenom} {n.nom}
        </h1>
        <StatutBadge statut={n.statut} />
      </div>
      <p className="numero">Acte n° {n.numeroActe}</p>

      <p>
        <Link to={`/naissances/${n.id}/certificat`} className="bouton">
          🖨 Certificat à imprimer
        </Link>
      </p>

      <dl className="fiche">
        <dt>Sexe</dt>
        <dd>{libellesSexe[n.sexe]}</dd>
        <dt>Né(e) le</dt>
        <dd>{formatDateHeure(n.dateHeureNaissance)}</dd>
        <dt>Lieu</dt>
        <dd>
          {n.etablissement}, {n.ville}
        </dd>
        <dt>Commune d’enregistrement</dt>
        <dd>{n.commune}</dd>
        <dt>Code de vérification</dt>
        <dd>
          <code>{formaterCode(n.codeVerification)}</code>
        </dd>
        <dt>Poids / taille</dt>
        <dd>
          {n.poidsGrammes.toLocaleString('fr-CA')} g — {n.tailleCm} cm
        </dd>
        <dt>Mère</dt>
        <dd>
          {n.mere.prenom} {n.mere.nom} (née le {formatDate(n.mere.dateNaissance)})
        </dd>
        {n.secondParent && (
          <>
            <dt>Second parent</dt>
            <dd>
              {n.secondParent.prenom} {n.secondParent.nom} (né(e) le {formatDate(n.secondParent.dateNaissance)})
            </dd>
          </>
        )}
        {n.motifAnnulation && (
          <>
            <dt>Motif d’annulation</dt>
            <dd>{n.motifAnnulation}</dd>
          </>
        )}
      </dl>

      {n.statut === 'Enregistree' && <AnnulationForm naissance={n} />}

      <p>
        <Link to="/naissances">← Retour à la liste</Link>
      </p>
    </article>
  );
}

/**
 * Petit formulaire contrôlé (useState) : 1 seul champ → RHF serait superflu.
 * key={naissance.version} côté parent n'est pas nécessaire ici car on se démonte
 * dès que le statut passe à « Annulee » (mise à jour optimiste).
 */
function AnnulationForm({ naissance }: { naissance: NaissanceDetail }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState('');
  const annuler = useAnnulerNaissance();
  const conflit = annuler.error instanceof ApiError && annuler.error.isConflict;

  const motifValide = motif.trim().length >= 10;

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    if (!motifValide) return;
    annuler.mutate({ id: naissance.id, motif: motif.trim(), version: naissance.version });
  };

  if (!ouvert) {
    return (
      <button type="button" className="bouton--danger" onClick={() => setOuvert(true)}>
        Annuler cette déclaration
      </button>
    );
  }

  return (
    <form onSubmit={soumettre} className="encart" aria-labelledby="titre-annulation">
      <h2 id="titre-annulation">Annuler la déclaration</h2>
      <label htmlFor="motif">Motif (10 caractères minimum)</label>
      <textarea
        id="motif"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        rows={3}
        aria-invalid={motif.length > 0 && !motifValide}
        autoFocus
      />
      {annuler.isError && (
        <p role="alert" className="champ__erreur">
          {conflit
            ? 'Quelqu’un a modifié cette déclaration entre-temps. Les données ont été rechargées, vérifiez puis recommencez.'
            : annuler.error.message}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="bouton--danger" disabled={!motifValide || annuler.isPending}>
          {annuler.isPending ? 'Annulation…' : 'Confirmer l’annulation'}
        </button>
        <button type="button" onClick={() => setOuvert(false)}>
          Fermer
        </button>
      </div>
    </form>
  );
}
