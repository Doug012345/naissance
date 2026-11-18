using Naissances.Domain.Communs;
using Naissances.Domain.Naissances;

namespace Naissances.Domain.Tests;

public class NaissanceTests
{
    private static readonly DateTime Maintenant = new(2026, 11, 18, 12, 0, 0, DateTimeKind.Utc);

    private static Naissance Creer(DateTime? date = null, int poids = 3400) =>
        Naissance.Enregistrer(
            "N-2026-000001",
            Identite.Creer("Léa", "Tremblay", "enfant"),
            Sexe.Feminin,
            date ?? Maintenant.AddHours(-5),
            "CHU Sainte-Justine", "Montréal",
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
}
