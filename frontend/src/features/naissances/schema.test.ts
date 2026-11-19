import { creerSchemaNaissance, valeursParDefaut, versRequete, type NaissanceFormInput } from './schema';

const maintenant = () => new Date('2026-11-18T12:00:00');
const schema = creerSchemaNaissance(maintenant);

const valide: NaissanceFormInput = {
  ...valeursParDefaut,
  prenom: 'Léa',
  nom: 'Tremblay',
  sexe: 'Feminin',
  dateHeureNaissance: '2026-11-18T08:30',
  etablissement: 'CHU Sainte-Justine',
  ville: 'Montréal',
  commune: 'Montréal',
  poidsGrammes: 3400,
  tailleCm: 50.5,
  mere: { prenom: 'Marie', nom: 'Tremblay', dateNaissance: '1994-03-02' },
};

const erreursDe = (v: NaissanceFormInput) => {
  const r = schema.safeParse(v);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('schéma de déclaration de naissance', () => {
  it('accepte une déclaration valide', () => {
    expect(schema.safeParse(valide).success).toBe(true);
  });

  it('refuse une date dans le futur', () => {
    expect(erreursDe({ ...valide, dateHeureNaissance: '2026-11-18T13:00' })).toHaveProperty(
      'dateHeureNaissance',
      'La date ne peut pas être dans le futur.',
    );
  });

  it('refuse une déclaration de plus de 30 jours', () => {
    expect(erreursDe({ ...valide, dateHeureNaissance: '2026-10-01T10:00' })).toHaveProperty('dateHeureNaissance');
  });

  it('refuse un poids vide (NaN) avec un message lisible', () => {
    expect(erreursDe({ ...valide, poidsGrammes: Number.NaN })).toHaveProperty(
      'poidsGrammes',
      'Le poids est obligatoire.',
    );
  });

  it('vérifie l’âge de la mère (règle inter-champs)', () => {
    expect(erreursDe({ ...valide, mere: { ...valide.mere, dateNaissance: '2020-01-01' } })).toHaveProperty(
      'mere.dateNaissance',
    );
  });

  it('exige les champs du second parent seulement si la case est cochée', () => {
    expect(schema.safeParse(valide).success).toBe(true);
    expect(erreursDe({ ...valide, avecSecondParent: true })).toHaveProperty('secondParent.prenom');
  });

  it('versRequete envoie secondParent = null quand la case est décochée', () => {
    const v = schema.parse({ ...valide, secondParent: { prenom: 'X', nom: 'Y', dateNaissance: '1990-01-01' } });
    expect(versRequete(v).secondParent).toBeNull();
  });
});
