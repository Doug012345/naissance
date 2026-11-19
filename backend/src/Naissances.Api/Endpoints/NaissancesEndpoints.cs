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

        return g;
    }
}
