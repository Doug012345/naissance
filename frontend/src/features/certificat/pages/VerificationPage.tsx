import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../api/client';
import { formaterCode } from '../../../api/naissances';
import { useVerification } from '../../naissances/hooks';
import { formatDate } from '../../naissances/components/StatutBadge';

/**
 * Page PUBLIQUE (sans connexion), ouverte en scannant le QR code du certificat :
 *   /verifier            → formulaire pour saisir le code à la main
 *   /verifier/K7QF-9M2X  → résultat
 * Elle n'affiche que le minimum (initiales, date, commune, statut) : la personne qui vérifie
 * compare avec le papier qu'elle a en main. Aucune autre donnée personnelle n'est exposée.
 */
export default function VerificationPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [saisie, setSaisie] = useState(code);

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    const propre = saisie.trim().toUpperCase();
    if (propre) navigate(`/verifier/${encodeURIComponent(propre)}`);
  };

  return (
    <main id="contenu" className="contenu contenu--etroit">
      <h1>Vérifier un certificat de naissance</h1>
      <p className="champ__aide">
        Saisissez le code imprimé sous le QR code du certificat, ou scannez le QR code avec votre téléphone.
      </p>

      <form onSubmit={soumettre} className="carte pile" role="search">
        <label htmlFor="code-verification">Code de vérification</label>
        <input
          id="code-verification"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="ex. K7QF-9M2X"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
        />
        <button type="submit">Vérifier</button>
      </form>

      {code && <Resultat code={code} />}

      <p>
        <Link to="/connexion">Espace agents</Link>
      </p>
    </main>
  );
}

function Resultat({ code }: { code: string }) {
  const { data: v, isPending, isError, error } = useVerification(code);

  if (isPending) return <p aria-busy="true">Vérification…</p>;

  if (isError) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div role="alert" className="encart encart--erreur">
        {status === 404 ? (
          <>
            <p>
              <strong>❌ Aucun acte ne correspond au code {code}.</strong>
            </p>
            <p>Vérifiez la saisie. Si le code est correct, ce certificat n’est pas authentique.</p>
          </>
        ) : status === 429 ? (
          <p>Trop de vérifications en peu de temps. Réessayez dans une minute.</p>
        ) : (
          <p>La vérification est momentanément impossible. Réessayez plus tard.</p>
        )}
      </div>
    );
  }

  const annule = v.statut === 'Annulee';
  const remplace = Boolean(v.remplace);
  let titre = '✅ Certificat authentique';
  if (annule) titre = '⚠️ Cet acte a été ANNULÉ';
  else if (remplace) titre = '⚠️ Certificat REMPLACÉ (acte rectifié)';
  return (
    <section
      aria-labelledby="titre-resultat"
      className={`encart ${annule || remplace ? 'encart--erreur' : 'encart--succes'}`}
      role="status"
    >
      <h2 id="titre-resultat">{titre}</h2>
      {remplace && !annule && v.dateRectificationUtc && (
        <p>
          Ce certificat a été imprimé avant une rectification de l’acte, le {formatDate(v.dateRectificationUtc)}.
          Il n’est plus à jour : demandez un certificat récent.
        </p>
      )}
      <dl className="fiche">
        <dt>Acte n°</dt>
        <dd>{v.numeroActe}</dd>
        <dt>Enfant (initiales)</dt>
        <dd>{v.initialesEnfant}</dd>
        <dt>Date de naissance</dt>
        <dd>{formatDate(v.dateNaissance)}</dd>
        <dt>Commune</dt>
        <dd>{v.commune}</dd>
        <dt>Enregistré le</dt>
        <dd>{formatDate(v.dateEnregistrementUtc)}</dd>
        {!remplace && v.dateRectificationUtc && (
          <>
            <dt>Rectifié le</dt>
            <dd>{formatDate(v.dateRectificationUtc)}</dd>
          </>
        )}
        <dt>Code</dt>
        <dd>{formaterCode(code.replace(/[-\s]/g, ''))}</dd>
      </dl>
      {annule && <p>Un certificat portant ce numéro ne doit plus être accepté.</p>}
    </section>
  );
}
