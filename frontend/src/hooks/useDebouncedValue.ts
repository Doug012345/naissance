import { useEffect, useState } from 'react';

/**
 * Retarde la propagation d'une valeur (ex. saisie de recherche) pour éviter
 * un appel API à chaque frappe. Le cleanup annule le timer précédent.
 */
export function useDebouncedValue<T>(valeur: T, delaiMs = 300): T {
  const [debounced, setDebounced] = useState(valeur);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(valeur), delaiMs);
    return () => clearTimeout(t);
  }, [valeur, delaiMs]);

  return debounced;
}
