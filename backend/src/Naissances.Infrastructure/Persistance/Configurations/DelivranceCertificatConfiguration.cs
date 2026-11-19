using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Naissances.Domain.Naissances;

namespace Naissances.Infrastructure.Persistance.Configurations;

/// <summary>Table etatcivil.DelivrancesCertificat : journal des impressions (audit).</summary>
internal sealed class DelivranceCertificatConfiguration : IEntityTypeConfiguration<DelivranceCertificat>
{
    public void Configure(EntityTypeBuilder<DelivranceCertificat> b)
    {
        b.ToTable("DelivrancesCertificat");
        b.HasKey(d => d.Id);
        b.Property(d => d.Id).ValueGeneratedNever();
        b.Property(d => d.DateDelivranceUtc).HasColumnType("datetime2(0)");
        b.Property(d => d.DelivrePar).HasMaxLength(256).IsRequired();

        // Une naissance ne peut pas avoir deux fois la même copie n° X.
        b.HasIndex(d => new { d.NaissanceId, d.NumeroCopie }).IsUnique();

        b.HasOne<Naissance>().WithMany().HasForeignKey(d => d.NaissanceId).OnDelete(DeleteBehavior.Restrict);
    }
}
