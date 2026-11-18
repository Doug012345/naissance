import type { StatutNaissance } from '../../../api/naissances';

export function StatutBadge({ statut }: { statut: StatutNaissance }) {
  return (
    <span className={`badge badge--${statut.toLowerCase()}`}>
      {statut === 'Enregistree' ? 'Enregistrée' : 'Annulée'}
    </span>
  );
}

export const formatDateHeure = (iso: string) =>
  new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
