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

public class RectificationTests
{
    private static readonly DateTime Maintenant = new(2026, 11, 18, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly DateEnfant = DateOnly.FromDateTime(Maintenant);

    private static Naissance Creer() =>
        Naissance.Enregistrer("N-2026-000001", Identite.Creer("Léa", "Tremblay", "enfant"), Sexe.Feminin,
            Maintenant.AddHours(-5), "CHU Sainte-Justine", "Montréal", "Montréal", 3400, 50.5m,
            Mere("Marie"), null, Maintenant);

    private static Parent Mere(string prenom) =>
        Parent.Creer(Identite.Creer(prenom, "Tremblay", "mere"), new DateOnly(1994, 3, 2), DateEnfant, "mere");

    private static RectificationNaissance Rectifier(Naissance n, string prenom = "Léa", string commune = "Montréal",
        string? motif = "Erreur de saisie du prénom", DateTime? date = null, string mere = "Marie") =>
        n.Rectifier(Identite.Creer(prenom, "Tremblay", "enfant"), Sexe.Feminin, date ?? Maintenant.AddHours(-5),
            "CHU Sainte-Justine", "Montréal", commune, 3400, 50.5m, Mere(mere), null,
            motif, "agent@exemple.ca", Maintenant.AddDays(3));

    [Fact]
    public void Rectifier_change_les_donnees_et_journalise_avant_apres()
    {
        var n = Creer();
        var numero = n.NumeroActe;

        var r = Rectifier(n, prenom: "Léana", mere: "Marie-Ève");

        Assert.Equal("Léana", n.Enfant.Prenom);
        Assert.Equal(numero, n.NumeroActe); // le numéro d'acte ne change jamais
        Assert.Equal(Maintenant.AddDays(3), n.DateDerniereRectificationUtc);
        Assert.Equal("agent@exemple.ca", r.RectifiePar);
        Assert.Equal(2, r.Changements.Count);
        Assert.Contains(r.Changements, c => c is { Champ: "Prénom", AncienneValeur: "Léa", NouvelleValeur: "Léana" });
        Assert.Contains(r.Changements, c => c.Champ == "Mère" && c.NouvelleValeur.StartsWith("Marie-Ève"));
    }

    [Fact]
    public void Rectifier_attribue_un_nouveau_code_et_garde_l_ancien_dans_l_historique()
    {
        var n = Creer();
        var ancien = n.CodeVerification;

        var r = Rectifier(n, commune: "Laval");

        Assert.NotEqual(ancien, n.CodeVerification);
        Assert.Equal(ancien, r.AncienCodeVerification);
    }

    [Fact]
    public void Rectifier_sans_aucun_changement_est_refuse()
    {
        var n = Creer();
        var code = n.CodeVerification;
        Assert.Throws<DomainException>(() => Rectifier(n));
        Assert.Equal(code, n.CodeVerification);
        Assert.Null(n.DateDerniereRectificationUtc);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Trop bref")] // 9 caractères
    public void Rectifier_exige_un_motif_d_au_moins_10_caracteres(string? motif)
    {
        var ex = Assert.Throws<DomainException>(() => Rectifier(Creer(), prenom: "Léana", motif: motif));
        Assert.Equal("motif", ex.Champ);
    }

    [Fact]
    public void Rectifier_un_acte_annule_est_interdit()
    {
        var n = Creer();
        n.Annuler("Doublon de saisie constaté");
        Assert.Throws<DomainException>(() => Rectifier(n, prenom: "Léana"));
    }

    [Fact]
    public void Rectifier_refuse_une_naissance_posterieure_a_l_enregistrement()
    {
        var ex = Assert.Throws<DomainException>(() => Rectifier(Creer(), date: Maintenant.AddDays(1)));
        Assert.Equal("dateHeureNaissance", ex.Champ);
    }

    [Fact]
    public void Rectifier_accepte_une_date_plus_de_30_jours_avant_aujourd_hui_si_proche_de_l_enregistrement()
    {
        // Rectification faite 3 jours après : la date reste valide par rapport à l'enregistrement.
        var n = Creer();
        Rectifier(n, date: Maintenant.AddDays(-29));
        Assert.Equal(Maintenant.AddDays(-29), n.DateHeureNaissance);
    }
}
