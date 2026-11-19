using Naissances.Domain.Communs;

namespace Naissances.Domain.Naissances;

public enum Sexe { Feminin = 1, Masculin = 2, Indetermine = 3 }

public enum StatutNaissance { Enregistree = 1, Annulee = 2 }

/// <summary>Identité d'une personne (enfant ou parent). Objet valeur immuable.</summary>
public sealed record Identite
{
    public string Prenom { get; }
    public string Nom { get; }

    private Identite(string prenom, string nom) { Prenom = prenom; Nom = nom; }

    public static Identite Creer(string? prenom, string? nom, string prefixeChamp)
    {
        if (string.IsNullOrWhiteSpace(prenom))
            throw new DomainException("Le prénom est obligatoire.", $"{prefixeChamp}.prenom");
        if (string.IsNullOrWhiteSpace(nom))
            throw new DomainException("Le nom est obligatoire.", $"{prefixeChamp}.nom");
        if (prenom.Trim().Length > 100 || nom.Trim().Length > 100)
            throw new DomainException("100 caractères maximum.", $"{prefixeChamp}.nom");

        return new Identite(prenom.Trim(), nom.Trim().ToUpperInvariant());
    }

    public string NomComplet => $"{Prenom} {Nom}";

    /// <summary>« Marie-Ève » « TREMBLAY » → « M.-È. T. » (page publique de vérification).</summary>
    public static string Initiales(string prenom, string nom)
    {
        static string DeMot(string mot) =>
            string.Join("-", mot.Split('-', StringSplitOptions.RemoveEmptyEntries)
                                .Select(p => char.ToUpperInvariant(p[0]) + "."));

        var mots = $"{prenom} {nom}".Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(" ", mots.Select(DeMot));
    }
}

/// <summary>Parent déclaré. La mère est obligatoire, le second parent est facultatif.</summary>
public sealed class Parent
{
    public Identite Identite { get; private set; } = null!;
    public DateOnly DateNaissance { get; private set; }

    private Parent() { } // EF Core

    public static Parent Creer(Identite identite, DateOnly dateNaissance, DateOnly dateNaissanceEnfant, string prefixeChamp)
    {
        var ageAuMoment = dateNaissanceEnfant.Year - dateNaissance.Year
                          - (dateNaissanceEnfant < dateNaissance.AddYears(dateNaissanceEnfant.Year - dateNaissance.Year) ? 1 : 0);

        if (ageAuMoment is < 12 or > 70)
            throw new DomainException("L'âge du parent à la naissance doit être entre 12 et 70 ans.",
                                      $"{prefixeChamp}.dateNaissance");

        return new Parent { Identite = identite, DateNaissance = dateNaissance };
    }
}
