using System.Globalization;
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

    /// <summary>Date de la dernière rectification (null si l'acte n'a jamais été rectifié).</summary>
    public DateTime? DateDerniereRectificationUtc { get; private set; }

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
        // Règle (exemple) : une déclaration doit être faite dans les 30 jours.
        Valider(dateHeureNaissance, etablissement, ville, commune, poidsGrammes, tailleCm,
                maintenantUtc, dateMinimale: maintenantUtc.AddDays(-30),
                messageDelai: "La déclaration doit être faite dans les 30 jours suivant la naissance.");

        return new Naissance
        {
            Id = Guid.CreateVersion7(),
            NumeroActe = numeroActe,
            Enfant = enfant,
            Sexe = sexe,
            DateHeureNaissance = dateHeureNaissance,
            Etablissement = etablissement!.Trim(),
            Ville = ville!.Trim(),
            Commune = commune!.Trim(),
            CodeVerification = Naissances.CodeVerification.Generer(),
            PoidsGrammes = poidsGrammes,
            TailleCm = tailleCm,
            Mere = mere,
            SecondParent = secondParent,
            Statut = StatutNaissance.Enregistree,
            DateEnregistrementUtc = maintenantUtc
        };
    }

    /// <summary>
    /// Rectifie l'acte (erreur de saisie…). Le numéro d'acte, la date d'enregistrement et le journal
    /// des copies ne changent jamais. Un NOUVEAU code de vérification est attribué : les certificats
    /// imprimés avant la rectification seront signalés « remplacés » par la page de vérification.
    /// </summary>
    /// <returns>L'entrée d'historique à enregistrer (champs modifiés, ancien code…).</returns>
    public RectificationNaissance Rectifier(
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
        string? motif,
        string? rectifiePar,
        DateTime maintenantUtc)
    {
        if (Statut == StatutNaissance.Annulee)
            throw new DomainException("Un acte annulé ne peut pas être rectifié.");
        if (string.IsNullOrWhiteSpace(motif) || motif.Trim().Length < 10)
            throw new DomainException("Le motif de rectification doit contenir au moins 10 caractères.", "motif");
        if (motif.Trim().Length > 500)
            throw new DomainException("Le motif est limité à 500 caractères.", "motif");
        if (string.IsNullOrWhiteSpace(rectifiePar))
            throw new DomainException("L'agent qui rectifie l'acte est obligatoire.");

        // La naissance doit rester compatible avec la date de la déclaration d'origine.
        Valider(dateHeureNaissance, etablissement, ville, commune, poidsGrammes, tailleCm,
                maintenantUtc, dateMinimale: DateEnregistrementUtc.AddDays(-30),
                messageDelai: "La date doit rester dans les 30 jours précédant l'enregistrement de l'acte.");
        if (dateHeureNaissance > DateEnregistrementUtc)
            throw new DomainException("La naissance ne peut pas être postérieure à l'enregistrement de l'acte.",
                                      "dateHeureNaissance");

        var changements = new List<ChangementChamp>();
        void Comparer(string champ, string ancienne, string nouvelle)
        {
            if (!string.Equals(ancienne, nouvelle, StringComparison.Ordinal))
                changements.Add(ChangementChamp.Creer(champ, ancienne, nouvelle));
        }

        Comparer("Prénom", Enfant.Prenom, enfant.Prenom);
        Comparer("Nom", Enfant.Nom, enfant.Nom);
        Comparer("Sexe", Libelle(Sexe), Libelle(sexe));
        Comparer("Date et heure de naissance", Texte(DateHeureNaissance), Texte(dateHeureNaissance));
        Comparer("Établissement", Etablissement, etablissement!.Trim());
        Comparer("Ville", Ville, ville!.Trim());
        Comparer("Commune", Commune, commune!.Trim());
        Comparer("Poids", $"{PoidsGrammes} g", $"{poidsGrammes} g");
        Comparer("Taille", Texte(TailleCm), Texte(tailleCm));
        Comparer("Mère", Texte(Mere), Texte(mere));
        Comparer("Second parent", Texte(SecondParent), Texte(secondParent));

        if (changements.Count == 0)
            throw new DomainException("Aucune modification : les informations sont identiques à l'acte actuel.");

        var rectification = RectificationNaissance.Creer(
            Id, rectifiePar.Trim(), motif.Trim(), CodeVerification, changements, maintenantUtc);

        Enfant = enfant;
        Sexe = sexe;
        DateHeureNaissance = dateHeureNaissance;
        Etablissement = etablissement.Trim();
        Ville = ville.Trim();
        Commune = commune.Trim();
        PoidsGrammes = poidsGrammes;
        TailleCm = tailleCm;
        Mere = mere;
        SecondParent = secondParent;
        CodeVerification = Naissances.CodeVerification.Generer();
        DateDerniereRectificationUtc = maintenantUtc;

        return rectification;
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

    /// <summary>Règles communes à l'enregistrement et à la rectification.</summary>
    private static void Valider(DateTime dateHeureNaissance, string? etablissement, string? ville, string? commune,
        int poidsGrammes, decimal tailleCm, DateTime maintenantUtc, DateTime dateMinimale, string messageDelai)
    {
        if (dateHeureNaissance > maintenantUtc)
            throw new DomainException("La date de naissance ne peut pas être dans le futur.", "dateHeureNaissance");

        if (dateHeureNaissance < dateMinimale)
            throw new DomainException(messageDelai, "dateHeureNaissance");

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
    }

    // Valeurs lisibles pour l'historique (indépendantes de la culture du serveur).
    private static string Libelle(Sexe s) => s switch
    {
        Sexe.Feminin => "Féminin",
        Sexe.Masculin => "Masculin",
        _ => "Indéterminé"
    };

    private static string Texte(DateTime d) => d.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);

    private static string Texte(decimal cm) => $"{cm.ToString("0.#", CultureInfo.InvariantCulture).Replace('.', ',')} cm";

    private static string Texte(Parent? p) => p is null
        ? "—"
        : $"{p.Identite.Prenom} {p.Identite.Nom} (naissance : {p.DateNaissance.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)})";
}
