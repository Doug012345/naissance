import { useMemo } from 'react';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '../../../api/client';
import type { EnregistrerNaissanceRequete } from '../../../api/naissances';
import { Champ } from '../../../components/Champ';
import {
  champFormulaireDepuisApi,
  creerSchemaNaissance,
  valeursParDefaut,
  versRequete,
  type NaissanceFormInput,
  type NaissanceFormValues,
} from '../schema';

interface NaissanceFormProps {
  onSoumettre: (requete: EnregistrerNaissanceRequete) => Promise<unknown>;
  /** Injectable pour les tests. */
  maintenant?: () => Date;
}

/**
 * Formulaire de déclaration — React Hook Form + Zod.
 *
 * Pourquoi RHF ? Inputs NON contrôlés (register) → pas de re-render à chaque frappe,
 * même avec ~15 champs. On ne « regarde » (useWatch) que ce qui pilote l'affichage.
 */
export function NaissanceForm({ onSoumettre, maintenant }: NaissanceFormProps) {
  // Le schéma ne doit pas être recréé à chaque rendu.
  const schema = useMemo(() => creerSchemaNaissance(maintenant), [maintenant]);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NaissanceFormInput, unknown, NaissanceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: valeursParDefaut,
    mode: 'onTouched', // valide au blur, puis à chaque frappe sur les champs touchés
  });

  // Seul ce champ provoque un re-render du formulaire quand il change.
  const avecSecondParent = useWatch({ control, name: 'avecSecondParent' });

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      await onSoumettre(versRequete(valeurs));
    } catch (e) {
      // 422 du domaine C# → on affiche l'erreur SOUS le champ concerné.
      if (e instanceof ApiError && e.isValidation) {
        const parChamp = Object.entries(e.fieldErrors);
        for (const [champApi, message] of parChamp) {
          const champ = champFormulaireDepuisApi(champApi);
          if (champ === 'general') setError('root.serveur', { message });
          else setError(champ as Path<NaissanceFormInput>, { message }, { shouldFocus: true });
        }
        if (parChamp.length === 0) setError('root.serveur', { message: e.message });
        return;
      }
      setError('root.serveur', {
        message: e instanceof Error ? e.message : 'Erreur inattendue, réessayez.',
      });
    }
  });

  const nbErreurs = Object.keys(errors).filter((k) => k !== 'root').length;

  return (
    <form onSubmit={soumettre} noValidate aria-describedby="resume-erreurs" className="formulaire">
      {/* Résumé annoncé aux lecteurs d'écran après une soumission invalide. */}
      <div id="resume-erreurs" aria-live="assertive">
        {errors.root?.serveur && (
          <p role="alert" className="encart encart--erreur">
            {errors.root.serveur.message}
          </p>
        )}
        {nbErreurs > 0 && !errors.root && (
          <p className="encart encart--erreur">
            {nbErreurs} section(s) du formulaire contiennent des erreurs.
          </p>
        )}
      </div>

      <fieldset>
        <legend>Enfant</legend>
        <div className="grille">
          <Champ label="Prénom" requis erreur={errors.prenom?.message}>
            {(a11y) => <input {...a11y} autoComplete="off" {...register('prenom')} />}
          </Champ>
          <Champ label="Nom" requis erreur={errors.nom?.message}>
            {(a11y) => <input {...a11y} autoComplete="off" {...register('nom')} />}
          </Champ>
        </div>

        <fieldset className="radios" aria-invalid={Boolean(errors.sexe)}>
          <legend>
            Sexe <span aria-hidden="true">*</span>
          </legend>
          <label>
            <input type="radio" value="Feminin" {...register('sexe')} /> Féminin
          </label>
          <label>
            <input type="radio" value="Masculin" {...register('sexe')} /> Masculin
          </label>
          <label>
            <input type="radio" value="Indetermine" {...register('sexe')} /> Indéterminé
          </label>
          {errors.sexe && <p className="champ__erreur">{errors.sexe.message}</p>}
        </fieldset>

        <div className="grille">
          <Champ label="Date et heure de naissance" requis erreur={errors.dateHeureNaissance?.message}>
            {(a11y) => <input type="datetime-local" {...a11y} {...register('dateHeureNaissance')} />}
          </Champ>
          <Champ label="Poids (g)" requis erreur={errors.poidsGrammes?.message} aide="Entre 300 et 7 000 g">
            {(a11y) => (
              <input
                type="number"
                inputMode="numeric"
                {...a11y}
                {...register('poidsGrammes', { valueAsNumber: true })}
              />
            )}
          </Champ>
          <Champ label="Taille (cm)" requis erreur={errors.tailleCm?.message}>
            {(a11y) => (
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                {...a11y}
                {...register('tailleCm', { valueAsNumber: true })}
              />
            )}
          </Champ>
        </div>
      </fieldset>

      <fieldset>
        <legend>Lieu</legend>
        <div className="grille">
          <Champ label="Établissement" requis erreur={errors.etablissement?.message}>
            {(a11y) => <input {...a11y} {...register('etablissement')} />}
          </Champ>
          <Champ label="Ville" requis erreur={errors.ville?.message}>
            {(a11y) => <input {...a11y} {...register('ville')} />}
          </Champ>
          <Champ
            label="Commune"
            requis
            erreur={errors.commune?.message}
            aide="Commune où l’acte est enregistré : imprimée sur le certificat"
          >
            {(a11y) => <input {...a11y} {...register('commune')} />}
          </Champ>
        </div>
      </fieldset>

      <fieldset>
        <legend>Mère</legend>
        <div className="grille">
          <Champ label="Prénom de la mère" requis erreur={errors.mere?.prenom?.message}>
            {(a11y) => <input {...a11y} {...register('mere.prenom')} />}
          </Champ>
          <Champ label="Nom de la mère" requis erreur={errors.mere?.nom?.message}>
            {(a11y) => <input {...a11y} {...register('mere.nom')} />}
          </Champ>
          <Champ label="Date de naissance de la mère" requis erreur={errors.mere?.dateNaissance?.message}>
            {(a11y) => <input type="date" {...a11y} {...register('mere.dateNaissance')} />}
          </Champ>
        </div>
      </fieldset>

      <fieldset>
        <legend>Second parent</legend>
        <label className="case">
          <input type="checkbox" {...register('avecSecondParent')} /> Déclarer un second parent
        </label>

        {/* Rendu conditionnel : les valeurs restent dans RHF si on décoche puis recoche. */}
        {avecSecondParent && (
          <div className="grille">
            <Champ label="Prénom du second parent" requis erreur={errors.secondParent?.prenom?.message}>
              {(a11y) => <input {...a11y} {...register('secondParent.prenom')} />}
            </Champ>
            <Champ label="Nom du second parent" requis erreur={errors.secondParent?.nom?.message}>
              {(a11y) => <input {...a11y} {...register('secondParent.nom')} />}
            </Champ>
            <Champ
              label="Date de naissance du second parent"
              requis
              erreur={errors.secondParent?.dateNaissance?.message}
            >
              {(a11y) => <input type="date" {...a11y} {...register('secondParent.dateNaissance')} />}
            </Champ>
          </div>
        )}
      </fieldset>

      <div className="actions">
        <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer la naissance'}
        </button>
      </div>
    </form>
  );
}
