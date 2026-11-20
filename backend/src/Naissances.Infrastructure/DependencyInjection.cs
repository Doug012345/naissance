using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Naissances.Application.Abstractions;
using Naissances.Infrastructure.Certificats;
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

        // Adresse publique du site : le QR code du PDF pointe vers <UrlSite>/verifier/<code>.
        var urlSite = config["Certificat:UrlSite"]
                      ?? throw new InvalidOperationException("Certificat:UrlSite manquant.");
        services.AddSingleton<IGenerateurCertificatPdf>(new GenerateurCertificatPdf(urlSite));
        return services;
    }
}
