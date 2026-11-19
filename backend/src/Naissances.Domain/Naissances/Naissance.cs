using Naissances.Domain.Communs;

namespace Naissances.Domain.Naissances;

/// <summary>
/// Agrégat racine : une déclaration de naissance.
/// Toutes les règles métier vivent ici — ni le contrôleur, ni React ne sont la
/// source de vérité (React valide pour l'UX, le domaine valide pour la sécurité).
/// </summary>
public sealed class Naissance
{
    public Guid Id { get; private set; }
    public string NumeroActe { get; private set; } = null!;
    public Identite Enfant { get; private set; } = null!;
    public Sexe Sexe { get; private set; }
    public DateTime DateHeureNaissance { get; private set; }
    public string Etablissement { get; private set; } = null!;
    public string Ville { get; private set; } = null!;

    /// <summary>Commune où l'acte est enregistré : imprimée en en-tête et sur le sceau du certificat.</summary>
    public string Commune { get; private set; } = null!;

    /// <summary>Code aléatoire imprimé sur le certificat (QR code) : voir <see cref="Naissances.CodeVerification"/>.</summary>
    public string CodeVerification { get; private set; } = null!;

    public int PoidsGrammes { get; private set; }
    public decimal TailleCm { get; private set; }
    public Parent Mere { get; private set; } = null!;
    public Parent? SecondParent { get; private set; }
    public StatutNaissance Statut { get; private set; }
    public string? MotifAnnulation { get; private set; }
    public DateTime DateEnregistrementUtc { get; private set; }

    /// <summary>Jeton de concurrence optimiste (rowversion SQL Server).</summary>
    public byte[] Version { get; private set; } = [];

    private Naissance() { } // EF Core

    public static Naissance Enregistrer(
        string numeroActe,
        Identite enfant,
        Sexe sexe,
        DateTime dateHeureNaissance,
        string? etablissement,
        string? ville,
        string? commune,
        int poidsGrammes,
        decimal tailleCm,
        Parent mere,
        Parent? secondParent,
        DateTime maintenantUtc)
    {
        if (dateHeureNaissance > maintenantUtc)
            throw new DomainException("La date de naissance ne peut pas être dans le futur.", "dateHeureNaissance");

        // Règle (exemple) : une déclaration doit être faite dans les 30 jours.
        if (dateHeureNaissance < maintenantUtc.AddDays(-30))
            throw new DomainException("La déclaration doit être faite dans les 30 jours suivant la naissance.",
                                      "dateHeureNaissance");

        if (poidsGrammes is < 300 or > 7000)
            throw new DomainException("Le poids doit être entre 300 g et 7 000 g.", "poidsGrammes");

        if (tailleCm is < 20 or > 65)
            throw new DomainException("La taille doit être entre 20 et 65 cm.", "tailleCm");

        if (string.IsNullOrWhiteSpace(etablissement))
            throw new DomainException("L'établissement est obligatoire.", "etablissement");

        if (string.IsNullOrWhiteSpace(ville))
            throw new DomainException("La ville est obligatoire.", "ville");

        if (string.IsNullOrWhiteSpace(commune))
            throw new DomainException("La commune est obligatoire.", "commune");

        return new Naissance
        {
            Id = Guid.CreateVersion7(),
            NumeroActe = numeroActe,
            Enfant = enfant,
            Sexe = sexe,
            DateHeureNaissance = dateHeureNaissance,
            Etablissement = etablissement.Trim(),
            Ville = ville.Trim(),
            Commune = commune.Trim(),
            CodeVerification = Naissances.CodeVerification.Generer(),
            PoidsGrammes = poidsGrammes,
            TailleCm = tailleCm,
            Mere = mere,
            SecondParent = secondParent,
            Statut = StatutNaissance.Enregistree,
            DateEnregistrementUtc = maintenantUtc
        };
    }

    public void Annuler(string? motif)
    {
        if (Statut == StatutNaissance.Annulee)
            throw new DomainException("Cette naissance est déjà annulée.");
        if (string.IsNullOrWhiteSpace(motif) || motif.Trim().Length < 10)
            throw new DomainException("Le motif d'annulation doit contenir au moins 10 caractères.", "motif");

        Statut = StatutNaissance.Annulee;
        MotifAnnulation = motif.Trim();
    }
}
