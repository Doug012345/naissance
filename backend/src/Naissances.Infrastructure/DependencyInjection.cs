using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Naissances.Application.Abstractions;
using Naissances.Infrastructure.Persistance;

namespace Naissances.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AjouterInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var cs = config.GetConnectionString("Naissances")
                 ?? throw new InvalidOperationException("ConnectionStrings:Naissances manquante.");

        services.AddDbContext<NaissancesDbContext>(o =>
            o.UseSqlServer(cs, sql => sql.EnableRetryOnFailure(3)));

        services.AddScoped<INaissanceRepository, NaissanceRepository>();
        services.AddScoped<ILectureNaissances, LectureNaissances>();
        services.AddScoped<IGenerateurNumeroActe, GenerateurNumeroActe>();
        return services;
    }
}
