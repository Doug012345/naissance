import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { StatutNaissance } from '../../../api/naissances';
import { libellesSexe } from '../../../api/naissances';
import { Pagination } from '../../../components/Pagination';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useNaissances } from '../hooks';
import { formatDateHeure, StatutBadge } from '../components/StatutBadge';

const TAILLE_PAGE = 10;

/**
 * Liste paginée + recherche.
 *
 * L'état des filtres vit dans l'URL (?q=…&statut=…&page=…) et non dans useState :
 *  - lien partageable / favori
 *  - bouton « Précédent » du navigateur fonctionne
 *  - un F5 conserve la recherche
 */
export function ListeNaissancesPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const statut = (params.get('statut') || undefined) as StatutNaissance | undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);

  // La saisie est locale (réactive à chaque frappe) ; l'URL n'est mise à jour qu'après 300 ms.
  const [saisie, setSaisie] = useState(q);
  const rechercheDebounced = useDebouncedValue(saisie.trim(), 300);

  // Si l'URL change de l'extérieur (bouton Précédent, lien), on resynchronise la saisie.
  // Pattern « ajuster l'état pendant le rendu » (recommandé plutôt qu'un useEffect).
  const [qPrecedent, setQPrecedent] = useState(q);
  if (q !== qPrecedent) {
    setQPrecedent(q);
    setSaisie(q);
  }

  useEffect(() => {
    // On n'écrit dans l'URL que lorsque la saisie est « stabilisée » (debounce terminé).
    if (rechercheDebounced !== saisie.trim() || rechercheDebounced === q) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (rechercheDebounced) next.set('q', rechercheDebounced);
        else next.delete('q');
        next.delete('page'); // nouvelle recherche → retour page 1
        return next;
      },
      { replace: true }, // ne pas polluer l'historique à chaque frappe
    );
  }, [rechercheDebounced, saisie, q, setParams]);

  const majParam = (cle: string, valeur?: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (valeur) next.set(cle, valeur);
      else next.delete(cle);
      if (cle !== 'page') next.delete('page');
      return next;
    });

  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = useNaissances({
    recherche: q || undefined,
    statut,
    page,
    taille: TAILLE_PAGE,
  });

  return (
    <section aria-labelledby="titre-liste">
      <div className="titre-ligne">
        <h1 id="titre-liste">Naissances enregistrées</h1>
        <Link to="/naissances/nouvelle" className="bouton">
          + Nouvelle déclaration
        </Link>
      </div>

      <search className="filtres">
        <label>
          Rechercher
          <input
            type="search"
            placeholder="Nom, prénom ou n° d’acte"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
          />
        </label>
        <label>
          Statut
          <select value={statut ?? ''} onChange={(e) => majParam('statut', e.target.value || undefined)}>
            <option value="">Tous</option>
            <option value="Enregistree">Enregistrées</option>
            <option value="Annulee">Annulées</option>
          </select>
        </label>
        {/* Indicateur discret pendant un rafraîchissement en arrière-plan. */}
        {isFetching && !isPending && <span className="spinner" aria-label="Mise à jour" />}
      </search>

      {isPending ? (
        <p aria-busy="true">Chargement des naissances…</p>
      ) : isError ? (
        <div role="alert" className="encart encart--erreur">
          <p>Impossible de charger la liste : {error.message}</p>
          <button type="button" onClick={() => refetch()}>
            Réessayer
          </button>
        </div>
      ) : data.elements.length === 0 ? (
        <p className="encart">Aucune naissance ne correspond à votre recherche.</p>
      ) : (
        <>
          <p className="compteur" aria-live="polite">
            {data.total} résultat{data.total > 1 ? 's' : ''}
          </p>
          {/* Opacité réduite pendant le chargement de la page suivante (keepPreviousData). */}
          <table className="tableau" style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
            <caption className="sr-only">Liste des naissances</caption>
            <thead>
              <tr>
                <th scope="col">N° d’acte</th>
                <th scope="col">Enfant</th>
                <th scope="col">Sexe</th>
                <th scope="col">Naissance</th>
                <th scope="col">Ville</th>
                <th scope="col">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.elements.map((n) => (
                // key = id stable venant de la BD (jamais l'index du tableau).
                <tr key={n.id}>
                  <td>
                    <Link to={`/naissances/${n.id}`}>{n.numeroActe}</Link>
                  </td>
                  <td>{n.nomCompletEnfant}</td>
                  <td>{libellesSexe[n.sexe]}</td>
                  <td>{formatDateHeure(n.dateHeureNaissance)}</td>
                  <td>{n.ville}</td>
                  <td>
                    <StatutBadge statut={n.statut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            desactive={isPlaceholderData}
            onChange={(p) => majParam('page', String(p))}
          />
        </>
      )}
    </section>
  );
}
