import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ApiError } from '../../../api/client';
import { formaterCode, libellesSexe, type Delivrance, type NaissanceDetail } from '../../../api/naissances';
import { useDelivrerCertificat, useNaissance } from '../../naissances/hooks';
import { formatDate, formatDateHeure } from '../../naissances/components/StatutBadge';
import { Sceau } from '../components/Sceau';

/**
 * Certificat de naissance imprimable (format A4, ou « Enregistrer en PDF » depuis la boîte d'impression).
 *
 * Bouton « Imprimer » :
 *   1. POST /api/naissances/{id}/delivrances → la copie est journalisée (qui, quand, n° de copie)
 *   2. le n° de copie et la date s'affichent sur le certificat
 *   3. window.print() ouvre la boîte d'impression du navigateur
 * Le menu, les boutons et tout ce qui porte la classe « ne-pas-imprimer » sont masqués sur papier.
 */
export default function CertificatPage() {
  const { id = '' } = useParams();
  const { data: n, isPending, isError, error } = useNaissance(id);
  const delivrer = useDelivrerCertificat();
  const [delivrance, setDelivrance] = useState<Delivrance | null>(null);

  // On imprime APRÈS le rendu du n° de copie, sinon le papier afficherait l'ancien.
  useEffect(() => {
    if (delivrance) window.print();
  }, [delivrance]);

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

  const imprimer = () => delivrer.mutate(n.id, { onSuccess: setDelivrance });

  return (
    <>
      <div className="barre-certificat ne-pas-imprimer">
        <Link to={`/naissances/${n.id}`}>← Retour à la fiche</Link>
        <button type="button" className="bouton" onClick={imprimer} disabled={delivrer.isPending}>
          {delivrer.isPending ? 'Préparation…' : '🖨 Imprimer le certificat'}
        </button>
      </div>
      {n.statut === 'Annulee' && (
        <p className="encart encart--erreur ne-pas-imprimer">
          Cet acte est annulé : le certificat sera imprimé avec la mention « ANNULÉ ».
        </p>
      )}
      {delivrer.isError && (
        <p role="alert" className="encart encart--erreur ne-pas-imprimer">
          Impossible de préparer l’impression : {delivrer.error.message}
        </p>
      )}
      {delivrance && (
        <p role="status" className="encart encart--succes ne-pas-imprimer">
          Copie n° {delivrance.numeroCopie} enregistrée dans le journal des délivrances.
        </p>
      )}

      <Certificat naissance={n} delivrance={delivrance} />
    </>
  );
}

function Certificat({ naissance: n, delivrance }: { naissance: NaissanceDetail; delivrance: Delivrance | null }) {
  const code = formaterCode(n.codeVerification);
  const urlVerification = `${window.location.origin}/verifier/${code}`;
  const annule = n.statut === 'Annulee';
  const commune = n.commune.toLocaleUpperCase('fr-CA');
  const microTexte = `COMMUNE DE ${commune} · CERTIFICAT DE NAISSANCE · ACTE ${n.numeroActe} · `.repeat(12);

  return (
    <article className="certificat" aria-labelledby="titre-certificat">
      <FondGuilloche />
      <p className="certificat__micro" aria-hidden="true">{microTexte}</p>

      <header className="certificat__entete">
        <p className="certificat__commune">Commune de {n.commune}</p>
        <p className="certificat__service">Service de l’état civil</p>
        <h1 id="titre-certificat" className="certificat__titre">Certificat de naissance</h1>
        <p className="certificat__acte">Acte n° {n.numeroActe}</p>
      </header>

      <dl className="certificat__donnees">
        <dt>Nom</dt>
        <dd>{n.nom}</dd>
        <dt>Prénom(s)</dt>
        <dd>{n.prenom}</dd>
        <dt>Sexe</dt>
        <dd>{libellesSexe[n.sexe]}</dd>
        <dt>Date et heure de naissance</dt>
        <dd>{formatDateHeure(n.dateHeureNaissance)}</dd>
        <dt>Lieu de naissance</dt>
        <dd>
          {n.etablissement}, {n.ville}
        </dd>
        <dt>Mère</dt>
        <dd>
          {n.mere.prenom} {n.mere.nom}, née le {formatDate(n.mere.dateNaissance)}
        </dd>
        {n.secondParent && (
          <>
            <dt>Second parent</dt>
            <dd>
              {n.secondParent.prenom} {n.secondParent.nom}, né(e) le {formatDate(n.secondParent.dateNaissance)}
            </dd>
          </>
        )}
        <dt>Acte enregistré le</dt>
        <dd>{formatDate(n.dateEnregistrementUtc)}</dd>
      </dl>

      <p className="certificat__mention">
        Certifié conforme aux registres de l’état civil de la commune de {n.commune}.
      </p>

      <footer className="certificat__pied">
        <div className="certificat__sceau">
          <Sceau commune={n.commune} />
        </div>

        <div className="certificat__signature">
          <p>
            Délivré à {n.commune}, le{' '}
            {formatDate(delivrance?.dateDelivranceUtc ?? new Date().toISOString())}
          </p>
          <p className="certificat__copie">
            Copie n° {delivrance ? delivrance.numeroCopie : '— (attribué à l’impression)'}
          </p>
          <div className="certificat__ligne-signature" />
          <p>L’officier de l’état civil</p>
          {delivrance && <p className="certificat__agent">Réf. agent : {delivrance.delivrePar}</p>}
        </div>

        <div className="certificat__qr">
          <QRCodeSVG value={urlVerification} size={104} level="M" marginSize={0} title="QR code de vérification" />
          <p className="certificat__code">
            Code : <strong>{code}</strong>
          </p>
          <p className="certificat__verifier">
            Vérifier l’authenticité :<br />
            {window.location.host}/verifier
          </p>
        </div>
      </footer>

      <p className="certificat__micro" aria-hidden="true">{microTexte}</p>

      {annule && (
        <div className="certificat__filigrane" role="note" aria-label="Acte annulé">
          ANNULÉ
        </div>
      )}
    </article>
  );
}

/**
 * Fond « guilloché » : fines ondulations entrelacées, comme sur les billets et les diplômes.
 * En SVG (pas en image de fond CSS) pour qu'il soit imprimé même si le navigateur
 * n'imprime pas les arrière-plans. Une photocopie le rend flou : la copie se repère.
 */
function FondGuilloche() {
  const ondes = Array.from({ length: 18 }, (_, i) => {
    const y0 = 20 + i * 16;
    const amplitude = 6 + (i % 3) * 2;
    const phase = i * 0.7;
    const points = Array.from({ length: 61 }, (_, k) => {
      const x = k * 10;
      const y = y0 + amplitude * Math.sin(k / 3 + phase);
      return `${k === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`;
    }).join(' ');
    return <path key={i} d={points} />;
  });

  return (
    <svg className="certificat__fond" viewBox="0 0 600 310" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.6">{ondes}</g>
    </svg>
  );
}
