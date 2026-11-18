import { useId, type ReactNode } from 'react';

interface AccessibiliteChamp {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
}

interface ChampProps {
  label: string;
  erreur?: string;
  aide?: string;
  requis?: boolean;
  /** Render prop : le parent reçoit les attributs d'accessibilité à poser sur l'input. */
  children: (a11y: AccessibiliteChamp) => ReactNode;
}

/**
 * Enveloppe accessible d'un champ de formulaire :
 *  - <label htmlFor> relié à l'input via useId (IDs stables, compatibles SSR)
 *  - aria-invalid + aria-describedby pointant vers l'aide et l'erreur
 *  - le lecteur d'écran annonce l'erreur quand l'input reçoit le focus
 */
export function Champ({ label, erreur, aide, requis, children }: ChampProps) {
  const id = useId();
  const idAide = `${id}-aide`;
  const idErreur = `${id}-erreur`;
  const decrit = [aide && idAide, erreur && idErreur].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`champ${erreur ? ' champ--erreur' : ''}`}>
      <label htmlFor={id}>
        {label}
        {requis && <span aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(erreur), 'aria-describedby': decrit })}
      {aide && (
        <small id={idAide} className="champ__aide">
          {aide}
        </small>
      )}
      {erreur && (
        <p id={idErreur} className="champ__erreur">
          {erreur}
        </p>
      )}
    </div>
  );
}
