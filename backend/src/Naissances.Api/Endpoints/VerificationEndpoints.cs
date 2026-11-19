using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Naissances.Application.Abstractions;
using Naissances.Domain.Naissances;

namespace Naissances.Api.Endpoints;

/// <summary>
/// Vérification PUBLIQUE d'un certificat (sans connexion) : c'est la cible du QR code.
///   GET /api/verification/{code}  -> 200 (infos minimales) | 404 | 429 (trop de requêtes)
/// </summary>
public static class VerificationEndpoints
{
    public const string PolitiqueLimite = "verification";

    /// <summary>
    /// 20 vérifications par minute et par adresse IP : largement assez pour un humain,
    /// et rend inutile toute tentative de deviner des codes au hasard.
    /// </summary>
    public static IServiceCollection AjouterLimiteVerification(this IServiceCollection services) =>
        services.AddRateLimiter(o =>
        {
            o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            o.AddPolicy(PolitiqueLimite, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "inconnue",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
        });

    public static IEndpointRouteBuilder MapVerification(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/verification/{code}", async (string code, ILectureNaissances lecture, CancellationToken ct) =>
            CodeVerification.Normaliser(code) is { } normalise && await lecture.VerifierAsync(normalise, ct) is { } dto
                ? Results.Ok(dto)
                : Results.Problem(statusCode: 404, title: "Certificat introuvable",
                                  detail: "Aucun acte ne correspond à ce code de vérification."))
           .WithTags("Vérification")
           .AllowAnonymous()
           .RequireRateLimiting(PolitiqueLimite);

        return app;
    }
}
