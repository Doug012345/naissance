using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Naissances.Domain.Naissances;

namespace Naissances.Infrastructure.Persistance;

/// <summary>
/// IdentityDbContext ajoute les tables des comptes (AspNetUsers, AspNetRoles…) au même
/// schéma etatcivil. Les mots de passe y sont stockés HACHÉS (PBKDF2), jamais en clair.
/// </summary>
public sealed class NaissancesDbContext(DbContextOptions<NaissancesDbContext> options)
    : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<Naissance> Naissances => Set<Naissance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("etatcivil");
        base.OnModelCreating(modelBuilder); // tables Identity
        modelBuilder.HasSequence<long>("NumeroActeSequence").StartsAt(1).IncrementsBy(1);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NaissancesDbContext).Assembly);
    }
}
