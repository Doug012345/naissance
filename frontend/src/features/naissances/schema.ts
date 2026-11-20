import { z } from 'zod';
import type { EnregistrerNaissanceRequete, NaissanceDetail } from '../../api/naissances';

/**
 * Schéma Zod = validation côté client (UX immédiate).
 * Il REPREND les règles du domaine C# mais ne les remplace pas :
 * le serveur reste la source de vérité (422 si on contourne le front).
 *
 * `maintenant` est injectable → tests déterministes.
 */
const texte = (libelle: string, max = 100) =>
  z.string().trim().min(1, `${libelle} est obligatoire.`).max(max, `${max} caractères maximum.`);

const JOUR_MS = 24 * 60 * 60 * 1000;

function ageEnAnnees(naissance: Date, reference: Date) {
  let age = reference.getFullYear() - naissance.getFullYear();
  const anniversairePasse =
    reference.getMonth() > naissance.getMonth() ||
    (reference.getMonth() === naissance.getMonth() && reference.getDate() >= naissance.getDate());
  if (!anniversairePasse) age--;
  return age;
}

export interface OptionsSchema {
  /**
   * Rectification : date d'enregistrement de l'acte. La naissance doit rester dans les 30 jours
   * AVANT cette date (et pas après), au lieu des 30 jours avant aujourd'hui.
   */
  dateReference?: Date;
  /** Rectification : motif obligatoire (10 caractères minimum). */
  avecMotif?: boolean;
}

export function creerSchemaNaissance(maintenant: () => Date = () => new Date(), options: OptionsSchema = {}) {
  const { dateReference, avecMotif = false } = options;
  const reference = () => dateReference ?? maintenant();
  const parentPartiel = z.object({
    prenom: z.string(),
    nom: z.string(),
    dateNaissance: z.string(),
  });

  return z
    .object({
      prenom: texte('Le prénom'),
      nom: texte('Le nom'),
      sexe: z.enum(['Feminin', 'Masculin', 'Indetermine'], { error: 'Choisissez le sexe.' }),
      dateHeureNaissance: z
        .string()
        .min(1, 'La date et l’heure sont obligatoires.')
        .refine((v) => new Date(v) <= maintenant(), 'La date ne peut pas être dans le futur.')
        .refine(
          (v) => new Date(v).getTime() >= reference().getTime() - 30 * JOUR_MS,
          dateReference
            ? 'La date doit rester dans les 30 jours précédant l’enregistrement de l’acte.'
            : 'La déclaration doit être faite dans les 30 jours.',
        )
        .refine(
          (v) => !dateReference || new Date(v) <= dateReference,
          'La naissance ne peut pas être postérieure à l’enregistrement de l’acte.',
        ),
      etablissement: texte('L’établissement', 200),
      ville: texte('La ville'),
      commune: texte('La commune'),
      poidsGrammes: z
        .number({ error: 'Le poids est obligatoire.' })
        .int('Nombre entier de grammes.')
        .min(300, 'Minimum 300 g.')
        .max(7000, 'Maximum 7 000 g.'),
      tailleCm: z
        .number({ error: 'La taille est obligatoire.' })
        .min(20, 'Minimum 20 cm.')
        .max(65, 'Maximum 65 cm.'),
      mere: z.object({
        prenom: texte('Le prénom de la mère'),
        nom: texte('Le nom de la mère'),
        dateNaissance: z.string().min(1, 'La date de naissance de la mère est obligatoire.'),
      }),
      avecSecondParent: z.boolean(),
      secondParent: parentPartiel,
      motif: z.string(),
    })
    // Règles qui dépendent de PLUSIEURS champs → superRefine, avec `path` pour
    // que l'erreur s'affiche sous le bon input.
    .superRefine((d, ctx) => {
      const dateEnfant = new Date(d.dateHeureNaissance);

      const verifierAge = (dateParent: string, path: (string | number)[]) => {
        if (!dateParent || Number.isNaN(dateEnfant.getTime())) return;
        const age = ageEnAnnees(new Date(dateParent), dateEnfant);
        if (age < 12 || age > 70) {
          ctx.addIssue({ code: 'custom', path, message: 'Âge du parent à la naissance : 12 à 70 ans.' });
        }
      };

      verifierAge(d.mere.dateNaissance, ['mere', 'dateNaissance']);

      if (avecMotif) {
        const longueur = d.motif.trim().length;
        if (longueur < 10)
          ctx.addIssue({ code: 'custom', path: ['motif'], message: 'Le motif doit contenir au moins 10 caractères.' });
        else if (longueur > 500)
          ctx.addIssue({ code: 'custom', path: ['motif'], message: '500 caractères maximum.' });
      }

      if (d.avecSecondParent) {
        const sp = d.secondParent;
        if (!sp.prenom.trim())
          ctx.addIssue({ code: 'custom', path: ['secondParent', 'prenom'], message: 'Le prénom est obligatoire.' });
        if (!sp.nom.trim())
          ctx.addIssue({ code: 'custom', path: ['secondParent', 'nom'], message: 'Le nom est obligatoire.' });
        if (!sp.dateNaissance)
          ctx.addIssue({ code: 'custom', path: ['secondParent', 'dateNaissance'], message: 'La date est obligatoire.' });
        else verifierAge(sp.dateNaissance, ['secondParent', 'dateNaissance']);
      }
    });
}

export type NaissanceFormInput = z.input<ReturnType<typeof creerSchemaNaissance>>;
export type NaissanceFormValues = z.output<ReturnType<typeof creerSchemaNaissance>>;

export const valeursParDefaut: NaissanceFormInput = {
  prenom: '',
  nom: '',
  sexe: undefined as unknown as 'Feminin',
  dateHeureNaissance: '',
  etablissement: '',
  ville: '',
  commune: '',
  poidsGrammes: Number.NaN,
  tailleCm: Number.NaN,
  mere: { prenom: '', nom: '', dateNaissance: '' },
  avecSecondParent: false,
  secondParent: { prenom: '', nom: '', dateNaissance: '' },
  motif: '',
};

/** Fiche existante → valeurs du formulaire (rectification). */
export function valeursDepuisDetail(n: NaissanceDetail): NaissanceFormInput {
  return {
    prenom: n.prenom,
    nom: n.nom,
    sexe: n.sexe,
    dateHeureNaissance: n.dateHeureNaissance.slice(0, 16), // « 2026-11-10T08:30 » pour datetime-local
    etablissement: n.etablissement,
    ville: n.ville,
    commune: n.commune,
    poidsGrammes: n.poidsGrammes,
    tailleCm: n.tailleCm,
    mere: { ...n.mere },
    avecSecondParent: n.secondParent !== null,
    secondParent: n.secondParent ? { ...n.secondParent } : { prenom: '', nom: '', dateNaissance: '' },
    motif: '',
  };
}

/** Valeurs du formulaire → contrat de l'API (le second parent devient null). */
export function versRequete(v: NaissanceFormValues): EnregistrerNaissanceRequete {
  return {
    prenom: v.prenom,
    nom: v.nom,
    sexe: v.sexe,
    dateHeureNaissance: v.dateHeureNaissance,
    etablissement: v.etablissement,
    ville: v.ville,
    commune: v.commune,
    poidsGrammes: v.poidsGrammes,
    tailleCm: v.tailleCm,
    mere: v.mere,
    secondParent: v.avecSecondParent
      ? { prenom: v.secondParent.prenom.trim(), nom: v.secondParent.nom.trim(), dateNaissance: v.secondParent.dateNaissance }
      : null,
  };
}

/**
 * Les noms de champs renvoyés par l'API (« enfant.prenom », « mere.nom »…)
 * ne sont pas toujours identiques à ceux du formulaire : on les traduit ici.
 */
export function champFormulaireDepuisApi(champApi: string): string {
  const table: Record<string, string> = {
    'enfant.prenom': 'prenom',
    'enfant.nom': 'nom',
  };
  return table[champApi] ?? champApi;
}
