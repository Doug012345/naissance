using Microsoft.EntityFrameworkCore;
using Naissances.Domain.Naissances;

namespace Naissances.Infrastructure.Persistance;

public sealed class NaissancesDbContext(DbContextOptions<NaissancesDbContext> options) : DbContext(options)
{
    public DbSet<Naissance> Naissances => Set<Naissance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("etatcivil");
        modelBuilder.HasSequence<long>("NumeroActeSequence").StartsAt(1).IncrementsBy(1);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NaissancesDbContext).Assembly);
    }
}
