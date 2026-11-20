using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Naissances.Domain.Naissances;

namespace Naissances.Infrastructure.Persistance.Configurations;

/// <summary>
/// Mapping Fluent API : le domaine reste « propre » (aucun attribut EF).
/// Résultat : une seule table etatcivil.Naissances avec colonnes aplaties
/// (Enfant_Prenom, Mere_Nom, SecondParent_DateNaissance…).
/// </summary>
internal sealed class NaissanceConfiguration : IEntityTypeConfiguration<Naissance>
{
    public void Configure(EntityTypeBuilder<Naissance> b)
    {
        b.ToTable("Naissances");
        b.HasKey(n => n.Id);
        b.Property(n => n.Id).ValueGeneratedNever(); // Guid v7 généré par le domaine

        b.Property(n => n.NumeroActe).HasMaxLength(20).IsRequired();
        b.HasIndex(n => n.NumeroActe).IsUnique();

        b.OwnsOne(n => n.Enfant, e =>
        {
            e.Property(i => i.Prenom).HasColumnName("Enfant_Prenom").HasMaxLength(100).IsRequired();
            e.Property(i => i.Nom).HasColumnName("Enfant_Nom").HasMaxLength(100).IsRequired();
            e.HasIndex(i => i.Nom); // recherche par nom
        });
        b.Navigation(n => n.Enfant).IsRequired();

        b.Property(n => n.Sexe).HasConversion<string>().HasMaxLength(20);
        b.Property(n => n.Statut).HasConversion<string>().HasMaxLength(20);
        b.Property(n => n.DateHeureNaissance).HasColumnType("datetime2(0)");
        b.Property(n => n.DateEnregistrementUtc).HasColumnType("datetime2(0)");
        b.Property(n => n.DateDerniereRectificationUtc).HasColumnType("datetime2(0)");
        b.Property(n => n.Etablissement).HasMaxLength(200).IsRequired();
        b.Property(n => n.Ville).HasMaxLength(100).IsRequired();
        b.Property(n => n.Commune).HasMaxLength(100).IsRequired();

        // Code du QR : fixe, unique, cherché par la page publique de vérification.
        b.Property(n => n.CodeVerification).HasMaxLength(CodeVerification.Longueur).IsFixedLength()
         .IsUnicode(false).IsRequired();
        b.HasIndex(n => n.CodeVerification).IsUnique();
        b.Property(n => n.TailleCm).HasPrecision(4, 1);
        b.Property(n => n.MotifAnnulation).HasMaxLength(500);

        ConfigurerParent(b.OwnsOne(n => n.Mere), "Mere");
        b.Navigation(n => n.Mere).IsRequired();
        ConfigurerParent(b.OwnsOne(n => n.SecondParent), "SecondParent");

        // Concurrence optimiste : SQL Server rowversion -> HTTP 409 si conflit.
        b.Property(n => n.Version).IsRowVersion();

        b.HasIndex(n => n.DateHeureNaissance);
    }

    private static void ConfigurerParent(OwnedNavigationBuilder<Naissance, Parent> p, string prefixe)
    {
        p.Property(x => x.DateNaissance).HasColumnName($"{prefixe}_DateNaissance");
        p.OwnsOne(x => x.Identite, i =>
        {
            i.Property(x => x.Prenom).HasColumnName($"{prefixe}_Prenom").HasMaxLength(100);
            i.Property(x => x.Nom).HasColumnName($"{prefixe}_Nom").HasMaxLength(100);
        });
        p.Navigation(x => x.Identite).IsRequired();
    }
}
