using Naissances.Domain.Communs;
using Naissances.Domain.Naissances;

namespace Naissances.Domain.Tests;

public class NaissanceTests
{
    private static readonly DateTime Maintenant = new(2026, 11, 18, 12, 0, 0, DateTimeKind.Utc);

    private static Naissance Creer(DateTime? date = null, int poids = 3400, string? commune = "Montréal") =>
        Naissance.Enregistrer(
            "N-2026-000001",
            Identite.Creer("Léa", "Tremblay", "enfant"),
            Sexe.Feminin,
            date ?? Maintenant.AddHours(-5),
            "CHU Sainte-Justine", "Montréal", commune,
            poids, 50.5m,
            Parent.Creer(Identite.Creer("Marie", "Tremblay", "mere"), new DateOnly(1994, 3, 2),
                         DateOnly.FromDateTime(Maintenant), "mere"),
            null,
            Maintenant);

    [Fact]
    public void Enregistrer_donnees_valides_statut_enregistree_et_nom_en_majuscules()
    {
        var n = Creer();
        Assert.Equal(StatutNaissance.Enregistree, n.Statut);
        Assert.Equal("TREMBLAY", n.Enfant.Nom);
    }

    [Fact]
    public void Enregistrer_date_future_leve_exception_sur_le_bon_champ()
    {
        var ex = Assert.Throws<DomainException>(() => Creer(Maintenant.AddMinutes(1)));
        Assert.Equal("dateHeureNaissance", ex.Champ);
    }

    [Theory]
    [InlineData(299)]
    [InlineData(7001)]
    public void Enregistrer_poids_hors_limites_leve_exception(int poids)
    {
        var ex = Assert.Throws<DomainException>(() => Creer(poids: poids));
        Assert.Equal("poidsGrammes", ex.Champ);
    }

    [Fact]
    public void Annuler_deux_fois_est_interdit()
    {
        var n = Creer();
        n.Annuler("Doublon de saisie constaté");
        Assert.Throws<DomainException>(() => n.Annuler("Doublon de saisie constaté"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public void Enregistrer_sans_commune_leve_exception_sur_le_bon_champ(string? commune)
    {
        var ex = Assert.Throws<DomainException>(() => Creer(commune: commune));
        Assert.Equal("commune", ex.Champ);
    }

    [Fact]
    public void Enregistrer_genere_un_code_de_verification_valide_et_unique()
    {
        var a = Creer();
        var b = Creer();
        Assert.Equal("Montréal", a.Commune);
        Assert.Equal(CodeVerification.Longueur, a.CodeVerification.Length);
        Assert.All(a.CodeVerification, c => Assert.Contains(c, CodeVerification.Alphabet));
        Assert.NotEqual(a.CodeVerification, b.CodeVerification);
    }
}

public class CodeVerificationTests
{
    [Theory]
    [InlineData("K7QF-9M2X", "K7QF9M2X")]
    [InlineData("k7qf 9m2x", "K7QF9M2X")]
    [InlineData("O1IL-0000", "01110000")] // lettres ambiguës corrigées
    public void Normaliser_accepte_une_saisie_tolerante(string saisie, string attendu) =>
        Assert.Equal(attendu, CodeVerification.Normaliser(saisie));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("K7QF")]          // trop court
    [InlineData("K7QF-9M2X-1")]   // trop long
    [InlineData("K7QF-9M2U")]     // U hors alphabet
    [InlineData("K7QF'; DROP--")] // caractères interdits
    public void Normaliser_rejette_un_code_impossible(string? saisie) =>
        Assert.Null(CodeVerification.Normaliser(saisie));

    [Fact]
    public void Formater_ajoute_le_tiret() =>
        Assert.Equal("K7QF-9M2X", CodeVerification.Formater("K7QF9M2X"));
}

public class InitialesTests
{
    [Theory]
    [InlineData("Léa", "TREMBLAY", "L. T.")]
    [InlineData("Marie-Ève", "GAGNON", "M.-È. G.")]
    [InlineData("Jean Paul", "DE LA FONTAINE", "J. P. D. L. F.")]
    public void Initiales_respectent_les_prenoms_composes(string prenom, string nom, string attendu) =>
        Assert.Equal(attendu, Identite.Initiales(prenom, nom));
}

public class DelivranceCertificatTests
{
    [Fact]
    public void Creer_refuse_un_numero_de_copie_nul() =>
        Assert.Throws<DomainException>(() =>
            DelivranceCertificat.Creer(Guid.NewGuid(), 0, "agent@exemple.ca", DateTime.UtcNow));
}
