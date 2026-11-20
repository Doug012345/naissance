import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { NaissanceForm } from '../components/NaissanceForm';
import { useNaissance, useRectifierNaissance } from '../hooks';
import { valeursDepuisDetail } from '../schema';

/**
 * Rectification d'un acte : le formulaire de déclaration, prérempli, + un motif obligatoire.
 * Le numéro d'acte et la date d'enregistrement ne changent pas ; un nouveau code de vérification
 * est attribué (les certificats imprimés avant deviennent « remplacés »).
 */
export default function RectificationPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: n, isPending, isError, error } = useNaissance(id);
  const rectifier = useRectifierNaissance();
  const conflit = rectifier.error instanceof ApiError && rectifier.error.isConflict;

  const valeurs = useMemo(() => (n ? valeursDepuisDetail(n) : undefined), [n]);
  const options = useMemo(
    () => (n ? { avecMotif: true, dateReference: new Date(n.dateEnregistrementUtc) } : undefined),
    [n],
  );

  if (isPending) return <p aria-busy="true">Chargement…</p>;
  if (isError) {
    const introuvable = error instanceof ApiError && error.isNotFound;
    return (
      <div role="alert" className="encart encart--erreur">
        <p>{introuvable ? 'Cette naissance n’existe pas.' : `Erreur : ${error.message}`}</p>
        <Link to="/naissances">Retour à la liste</Link>
      </div>
    );
  }

  if (n.statut === 'Annulee') {
    return (
      <div role="alert" className="encart encart--erreur">
        <p>Un acte annulé ne peut pas être rectifié.</p>
        <Link to={`/naissances/${n.id}`}>← Retour à la fiche</Link>
      </div>
    );
  }

  return (
    <section aria-labelledby="titre-rectification">
      <p>
        <Link to={`/naissances/${n.id}`}>← Retour à la fiche</Link>
      </p>
      <h1 id="titre-rectification">Rectifier l’acte n° {n.numeroActe}</h1>
      <p className="encart">
        Chaque modification est conservée dans l’historique (ancienne et nouvelle valeur, agent, motif).
        Un <strong>nouveau code de vérification</strong> sera attribué : les certificats déjà imprimés seront
        signalés « remplacés » lors de leur vérification.
      </p>
      {conflit && (
        <p role="alert" className="encart encart--erreur">
          Quelqu’un a modifié cet acte entre-temps. Le formulaire a été rechargé avec les données à jour :
          vérifiez, puis refaites votre rectification.
        </p>
      )}
      {/* key : si l'acte change (autre agent, 409), le formulaire repart des nouvelles valeurs. */}
      <NaissanceForm
        key={n.version}
        valeursInitiales={valeurs}
        options={options}
        libelleSoumettre="Enregistrer la rectification"
        onSoumettre={async (donnees, motif) => {
          try {
            await rectifier.mutateAsync({ id: n.id, donnees, motif, version: n.version });
          } catch (e) {
            if (e instanceof ApiError && e.isConflict) return; // message affiché au-dessus
            throw e; // 422 : affiché sous le champ concerné par le formulaire
          }
          void navigate(`/naissances/${n.id}`, {
            state: { message: 'Acte rectifié. Un nouveau code de vérification a été attribué.' },
          });
        }}
      />
    </section>
  );
}
