import { z } from 'zod';

/** Mêmes règles que la configuration Identity côté C# (Authentification.cs). */
export const LONGUEUR_MIN_MOT_DE_PASSE = 10;
export const aideMotDePasse =
  `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial.`;

const courriel = z
  .string()
  .trim()
  .min(1, 'Le courriel est obligatoire.')
  .pipe(z.email('Courriel invalide.'));

export const schemaConnexion = z.object({
  courriel,
  motDePasse: z.string().min(1, 'Le mot de passe est obligatoire.'),
});

export const schemaMotDePasseOublie = z.object({ courriel });
export type MotDePasseOublieValeurs = z.infer<typeof schemaMotDePasseOublie>;
export type ConnexionValeurs = z.infer<typeof schemaConnexion>;

const nouveauMotDePasse = z
  .string()
  .min(1, 'Le nouveau mot de passe est obligatoire.')
  .min(LONGUEUR_MIN_MOT_DE_PASSE, `Au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`)
  .regex(/[a-z]/, 'Au moins une minuscule.')
  .regex(/[A-Z]/, 'Au moins une majuscule.')
  .regex(/\d/, 'Au moins un chiffre.')
  .regex(/[^a-zA-Z0-9]/, 'Au moins un caractère spécial.');

export const schemaChangementMotDePasse = z
  .object({
    motDePasseActuel: z.string().min(1, 'Le mot de passe actuel est obligatoire.'),
    nouveauMotDePasse,
    confirmation: z.string().min(1, 'Confirmez le nouveau mot de passe.'),
  })
  .superRefine((v, ctx) => {
    if (v.nouveauMotDePasse === v.motDePasseActuel) {
      ctx.addIssue({
        code: 'custom',
        path: ['nouveauMotDePasse'],
        message: 'Le nouveau mot de passe doit être différent de l’actuel.',
      });
    }
    if (v.confirmation !== v.nouveauMotDePasse) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmation'],
        message: 'Les deux mots de passe ne correspondent pas.',
      });
    }
  });
export type ChangementMotDePasseValeurs = z.infer<typeof schemaChangementMotDePasse>;

export const schemaReinitialisation = z
  .object({
    nouveauMotDePasse,
    confirmation: z.string().min(1, 'Confirmez le nouveau mot de passe.'),
  })
  .refine((v) => v.confirmation === v.nouveauMotDePasse, {
    path: ['confirmation'],
    message: 'Les deux mots de passe ne correspondent pas.',
  });
export type ReinitialisationValeurs = z.infer<typeof schemaReinitialisation>;
