using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Naissances.Application.Abstractions;
using Naissances.Domain.Communs;

namespace Naissances.Api;

/// <summary>
/// Traduit les exceptions en ProblemDetails (RFC 9457). Le frontend React lit
/// <c>status</c>, <c>detail</c> et <c>errors</c> pour afficher le bon message.
///   DomainException       -> 422 + errors { "poidsGrammes": ["..."] }
///   IntrouvableException  -> 404
///   ConcurrenceException  -> 409
/// </summary>
internal sealed class GestionErreurs(IProblemDetailsService problemDetails, ILogger<GestionErreurs> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception ex, CancellationToken ct)
    {
        ProblemDetails probleme = ex switch
        {
            DomainException d => new ValidationProblemDetails(
                new Dictionary<string, string[]> { [d.Champ ?? "general"] = [d.Message] })
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Règle métier non respectée",
                Detail = d.Message
            },
            IntrouvableException => new() { Status = 404, Title = "Introuvable", Detail = ex.Message },
            ConcurrenceException => new() { Status = 409, Title = "Conflit de modification", Detail = ex.Message },
            BadHttpRequestException => new() { Status = 400, Title = "Requête invalide", Detail = ex.Message },
            FormatException => new() { Status = 400, Title = "Format invalide", Detail = ex.Message },
            _ => new() { Status = 500, Title = "Erreur inattendue" }
        };

        if (probleme.Status == 500)
            logger.LogError(ex, "Erreur non gérée");

        http.Response.StatusCode = probleme.Status!.Value;
        return await problemDetails.TryWriteAsync(new() { HttpContext = http, ProblemDetails = probleme, Exception = ex });
    }
}
