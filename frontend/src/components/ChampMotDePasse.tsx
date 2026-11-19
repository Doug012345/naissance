import { useState, type ComponentPropsWithRef } from 'react';

type Props = Omit<ComponentPropsWithRef<'input'>, 'type'>;

/**
 * Input mot de passe + bouton « œil » pour afficher / masquer la saisie.
 *  - React 19 : `ref` est une prop ordinaire → compatible avec register() de React Hook Form.
 *  - Bouton type="button" : ne soumet pas le formulaire.
 *  - aria-pressed : le lecteur d'écran annonce « Afficher le mot de passe, bouton bascule, activé ».
 */
export function ChampMotDePasse(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mot-de-passe">
      <input {...props} type={visible ? 'text' : 'password'} spellCheck={false} autoCapitalize="off" />
      <button
        type="button"
        className="mot-de-passe__oeil"
        onClick={() => setVisible((v) => !v)}
        aria-label="Afficher le mot de passe"
        aria-pressed={visible}
        aria-controls={props.id}
        title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {visible ? <IconeOeilBarre /> : <IconeOeil />}
      </button>
    </div>
  );
}

const svg = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

function IconeOeil() {
  return (
    <svg {...svg}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconeOeilBarre() {
  return (
    <svg {...svg}>
      <path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6" />
      <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M2 2l20 20" />
    </svg>
  );
}
