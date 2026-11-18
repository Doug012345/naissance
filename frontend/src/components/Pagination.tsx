interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  desactive?: boolean;
}

export function Pagination({ page, totalPages, onChange, desactive }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={desactive || page <= 1}>
        ← Précédente
      </button>
      <span aria-live="polite">
        Page {page} sur {totalPages}
      </span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={desactive || page >= totalPages}>
        Suivante →
      </button>
    </nav>
  );
}
