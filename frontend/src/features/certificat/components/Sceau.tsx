import { useId } from 'react';

interface SceauProps {
  commune: string;
  /** Diamètre affiché (le dessin est vectoriel : net à l'impression). */
  taille?: number;
}

/**
 * Sceau rond de la commune, dessiné en SVG (pas d'image à télécharger, net à toutes les tailles).
 *   - en haut, sur l'anneau : « COMMUNE DE <NOM> »
 *   - en bas : « ★ ÉTAT CIVIL ★ »
 *   - au centre : « CERTIFIÉ CONFORME »
 * Ce sceau est propre à l'application : il n'imite aucun sceau officiel existant.
 */
export function Sceau({ commune, taille = 150 }: SceauProps) {
  // Identifiants uniques (plusieurs sceaux possibles sur une page) et valides dans un href.
  const base = `sceau-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const texteHaut = `COMMUNE DE ${commune.toLocaleUpperCase('fr-CA')}`;

  // L'arc du haut mesure ≈ 185 unités : on réduit la police pour les noms longs.
  const police = Math.max(7, Math.min(13, 185 / (texteHaut.length * 0.66)));

  return (
    <svg
      className="sceau"
      width={taille}
      height={taille}
      viewBox="0 0 160 160"
      role="img"
      aria-label={`Sceau : ${texteHaut}, état civil, certifié conforme`}
    >
      <defs>
        {/* Arc du haut, de gauche à droite : le texte se lit à l'endroit au-dessus. */}
        <path id={`${base}-haut`} d="M 20,80 A 60,60 0 0 1 140,80" />
        {/* Arc du bas, aussi de gauche à droite (sens inverse) : le texte reste lisible en bas. */}
        <path id={`${base}-bas`} d="M 11,80 A 69,69 0 0 0 149,80" />
      </defs>

      <circle cx="80" cy="80" r="76" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="80" cy="80" r="72" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="80" cy="80" r="50" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="46" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 2" />

      <text fontSize={police} fontWeight="700" letterSpacing="0.5" fill="currentColor">
        <textPath href={`#${base}-haut`} startOffset="50%" textAnchor="middle">
          {texteHaut}
        </textPath>
      </text>
      <text fontSize="11" fontWeight="700" letterSpacing="1.5" fill="currentColor">
        <textPath href={`#${base}-bas`} startOffset="50%" textAnchor="middle">
          ★ ÉTAT CIVIL ★
        </textPath>
      </text>

      <g fill="currentColor" textAnchor="middle" fontWeight="700">
        <text x="80" y="68" fontSize="14">★</text>
        <text x="80" y="84" fontSize="10.5" letterSpacing="0.6">CERTIFIÉ</text>
        <text x="80" y="97" fontSize="10.5" letterSpacing="0.6">CONFORME</text>
        <text x="80" y="112" fontSize="8">★ ★ ★</text>
      </g>
    </svg>
  );
}
