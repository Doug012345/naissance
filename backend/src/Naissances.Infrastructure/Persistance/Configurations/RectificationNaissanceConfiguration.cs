using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Naissances.Domain.Naissances;

namespace Naissances.Infrastructure.Persistance.Configurations;

/// <summary>
/// Table etatcivil.RectificationsNaissance : historique des rectifications (audit).
/// Les champs modifiés sont rangés dans une colonne JSON « Changements » (liste avant/après).
/// </summary>
internal sealed class RectificationNaissanceConfiguration : IEntityTypeConfiguration<RectificationNaissance>
{
    public void Configure(EntityTypeBuilder<RectificationNaissance> b)
    {
        b.ToTable("RectificationsNaissance");
        b.HasKey(r => r.Id);
        b.Property(r => r.Id).ValueGeneratedNever();
        b.Property(r => r.DateRectificationUtc).HasColumnType("datetime2(0)");
        b.Property(r => r.RectifiePar).HasMaxLength(256).IsRequired();
        b.Property(r => r.Motif).HasMaxLength(500).IsRequired();

        // Code des certificats imprimés avant la rectification : la page publique le cherche aussi.
        b.Property(r => r.AncienCodeVerification).HasMaxLength(CodeVerification.Longueur).IsFixedLength()
         .IsUnicode(false).IsRequired();
        b.HasIndex(r => r.AncienCodeVerification).IsUnique();

        b.OwnsMany(r => r.Changements, c =>
        {
            c.ToJson("Changements");
            c.Property(x => x.Champ);
            c.Property(x => x.AncienneValeur);
            c.Property(x => x.NouvelleValeur);
        });
        b.Navigation(r => r.Changements).HasField("_changements");

        b.HasIndex(r => r.NaissanceId);
        b.HasOne<Naissance>().WithMany().HasForeignKey(r => r.NaissanceId).OnDelete(DeleteBehavior.Restrict);
    }
}
