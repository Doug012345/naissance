namespace Naissances.Domain.Naissances;

/// <summary>
/// Journal d'audit : une rectification d'acte (qui, quand, pourquoi, quels champs).
/// Un acte d'état civil ne se « modifie » pas en silence : chaque correction laisse une trace,
/// avec l'ancienne et la nouvelle valeur de chaque champ.
///
/// <see cref="AncienCodeVerification"/> : le code imprimé sur les certificats délivrés AVANT la
/// rectification. La page publique le reconnaît encore et répond « certificat remplacé ».
/// </summary>
public sealed class RectificationNaissance
{
    private readonly List<ChangementChamp> _changements = [];

    public Guid Id { get; private set; }
    public Guid NaissanceId { get; private set; }
    public DateTime DateRectificationUtc { get; private set; }
    public string RectifiePar { get; private set; } = null!;
    public string Motif { get; private set; } = null!;
    public string AncienCodeVerification { get; private set; } = null!;
    public IReadOnlyList<ChangementChamp> Changements => _changements;

    private RectificationNaissance() { } // EF Core

    internal static RectificationNaissance Creer(Guid naissanceId, string rectifiePar, string motif,
        string ancienCode, IEnumerable<ChangementChamp> changements, DateTime maintenantUtc)
    {
        var r = new RectificationNaissance
        {
            Id = Guid.CreateVersion7(),
            NaissanceId = naissanceId,
            DateRectificationUtc = maintenantUtc,
            RectifiePar = rectifiePar,
            Motif = motif,
            AncienCodeVerification = ancienCode
        };
        r._changements.AddRange(changements);
        return r;
    }
}

/// <summary>Un champ rectifié : libellé lisible + valeurs avant/après (texte, pour l'historique).</summary>
public sealed class ChangementChamp
{
    public string Champ { get; private set; } = null!;
    public string AncienneValeur { get; private set; } = null!;
    public string NouvelleValeur { get; private set; } = null!;

    private ChangementChamp() { } // EF Core

    public static ChangementChamp Creer(string champ, string ancienne, string nouvelle) =>
        new() { Champ = champ, AncienneValeur = ancienne, NouvelleValeur = nouvelle };
}
