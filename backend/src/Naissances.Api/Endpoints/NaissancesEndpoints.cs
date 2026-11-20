using System.Security.Claims;
using Naissances.Application.Abstractions;
using Naissances.Application.Naissances;
using Naissances.Domain.Naissances;

namespace Naissances.Api.Endpoints;

/// <summary>
/// API REST consommée par le frontend React (TanStack Query) :
///   GET  /api/naissances?recherche=&amp;statut=&amp;page=&amp;taille=
///   GET  /api/naissances/{id}
///   POST /api/naissances                    -> 201 + Location
///   POST /api/naissances/{id}/annulation    -> 204 (409 si version périmée)
///   POST /api/naissances/{id}/delivrances   -> 201 (copie n° X du certificat, journalisée)
///   POST /api/naissances/{id}/certificat.pdf -> 200 PDF (copie journalisée, en-tête X-Numero-Copie)
///   POST /api/naissances/{id}/rectifications -> 204 (409 si version périmée, 422 si règle métier)
///   GET  /api/naissances/{id}/rectifications -> historique, le plus récent d'abord
/// </summary>
public static class NaissancesEndpoints
{
    public static RouteGroupBuilder MapNaissances(this IEndpointRouteBuilder app)
    {
        // Toutes les routes exigent un utilisateur connecté (sinon 401).
        var g = app.MapGroup("/api/naissances").WithTags("Naissances").RequireAuthorization();

        g.MapGet("/", async (string? recherche, StatutNaissance? statut, int? page, int? taille,
                             ILectureNaissances lecture, CancellationToken ct) =>
            TypedResults.Ok(await lecture.RechercherAsync(
                new RechercheNaissances(recherche, statut, page ?? 1, taille ?? 10), ct)));

        g.MapGet("/{id:guid}", async (Guid id, ILectureNaissances lecture, CancellationToken ct) =>
                await lecture.ObtenirDetailAsync(id, ct) is { } dto
                    ? Results.Ok(dto)
                    : Results.Problem(statusCode: 404, title: "Introuvable"))
         .WithName("ObtenirNaissance");

        g.MapPost("/", async (EnregistrerNaissanceCommande cmd, EnregistrerNaissance casUtilisation,
                              CancellationToken ct) =>
        {
            var id = await casUtilisation.ExecuterAsync(cmd, ct);
            return TypedResults.CreatedAtRoute(new { id }, "ObtenirNaissance", new { id });
        });

        g.MapPost("/{id:guid}/annulation", async (Guid id, AnnulerNaissanceCommande cmd,
                                                  AnnulerNaissance casUtilisation, CancellationToken ct) =>
        {
            await casUtilisation.ExecuterAsync(id, cmd, ct);
            return TypedResults.NoContent();
        });

        g.MapPost("/{id:guid}/rectifications", async (Guid id, RectifierNaissanceCommande cmd, ClaimsPrincipal user,
                                                      RectifierNaissance casUtilisation, CancellationToken ct) =>
        {
            await casUtilisation.ExecuterAsync(id, cmd, Agent(user), ct);
            return TypedResults.NoContent();
        });

        g.MapGet("/{id:guid}/rectifications", async (Guid id, ILectureNaissances lecture, CancellationToken ct) =>
            TypedResults.Ok(await lecture.ListerRectificationsAsync(id, ct)));

        // Appelé juste avant l'impression : journalise la copie et renvoie son numéro.
        g.MapPost("/{id:guid}/delivrances", async (Guid id, ClaimsPrincipal user,
                                                   DelivrerCertificat casUtilisation, CancellationToken ct) =>
        {
            var dto = await casUtilisation.ExecuterAsync(id, Agent(user), ct);
            return TypedResults.Created($"/api/naissances/{id}/delivrances/{dto.NumeroCopie}", dto);
        });

        // Téléchargement PDF : POST (et non GET) car chaque téléchargement crée une copie journalisée.
        g.MapPost("/{id:guid}/certificat.pdf", async (Guid id, ClaimsPrincipal user, HttpResponse reponse,
                                                      TelechargerCertificat casUtilisation, CancellationToken ct) =>
        {
            var pdf = await casUtilisation.ExecuterAsync(id, Agent(user), ct);
            reponse.Headers["X-Numero-Copie"] = pdf.NumeroCopie.ToString(System.Globalization.CultureInfo.InvariantCulture);
            reponse.Headers.CacheControl = "no-store"; // document personnel : jamais en cache
            return TypedResults.File(pdf.Contenu, "application/pdf", pdf.NomFichier);
        });

        return g;
    }

    /// <summary>Agent connecté, tel qu'il apparaît dans les journaux d'audit.</summary>
    private static string Agent(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Email) ?? user.Identity?.Name ?? "inconnu";
}
