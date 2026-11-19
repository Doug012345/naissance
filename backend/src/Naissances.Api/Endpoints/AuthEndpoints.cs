using System.Security.Claims;
using Microsoft.AspNetCore.Identity;

namespace Naissances.Api.Endpoints;

public sealed record ConnexionRequete(string Courriel, string MotDePasse);
public sealed record ChangerMotDePasseRequete(string MotDePasseActuel, string NouveauMotDePasse);
public sealed record UtilisateurDto(string Courriel);

/// <summary>
///   POST /api/auth/connexion      -> 200 + cookie | 401
///   POST /api/auth/deconnexion    -> 204
///   GET  /api/auth/moi            -> 200 | 401   (le frontend sait s'il est connecté)
///   POST /api/auth/mot-de-passe   -> 204 | 422 errors { motDePasseActuel | nouveauMotDePasse }
/// Pas d'inscription publique : un registre d'état civil n'est pas ouvert à tous.
/// </summary>
public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuth(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/auth").WithTags("Authentification");

        g.MapPost("/connexion", async (ConnexionRequete req, SignInManager<IdentityUser> signIn) =>
        {
            var user = await signIn.UserManager.FindByEmailAsync(req.Courriel?.Trim() ?? "");
            if (user is null)
                return Identifiants();

            var resultat = await signIn.PasswordSignInAsync(user, req.MotDePasse ?? "",
                isPersistent: false, lockoutOnFailure: true);

            if (resultat.IsLockedOut)
                return Results.Problem(statusCode: 401, title: "Compte verrouillé",
                    detail: "Trop de tentatives. Réessayez dans quelques minutes.");

            return resultat.Succeeded ? Results.Ok(new UtilisateurDto(user.Email!)) : Identifiants();
        }).AllowAnonymous();

        g.MapPost("/deconnexion", async (SignInManager<IdentityUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        }).AllowAnonymous();

        g.MapGet("/moi", (ClaimsPrincipal user) =>
            Results.Ok(new UtilisateurDto(user.FindFirstValue(ClaimTypes.Email) ?? user.Identity!.Name!)))
         .RequireAuthorization();

        g.MapPost("/mot-de-passe", async (ChangerMotDePasseRequete req, ClaimsPrincipal principal,
                                          SignInManager<IdentityUser> signIn) =>
        {
            var users = signIn.UserManager;
            var user = await users.GetUserAsync(principal);
            if (user is null) return Results.Unauthorized();

            var resultat = await users.ChangePasswordAsync(user, req.MotDePasseActuel ?? "", req.NouveauMotDePasse ?? "");
            if (!resultat.Succeeded)
            {
                // Chaque erreur va sous le bon champ du formulaire React.
                var errors = resultat.Errors
                    .GroupBy(e => e.Code == nameof(IdentityErrorDescriber.PasswordMismatch)
                        ? "motDePasseActuel" : "nouveauMotDePasse")
                    .ToDictionary(gr => gr.Key, gr => gr.Select(e => e.Description).ToArray());

                return Results.ValidationProblem(errors, statusCode: 422,
                    title: "Mot de passe non modifié", detail: errors.Values.First()[0]);
            }

            // Le changement régénère le « security stamp » : on renouvelle le cookie pour rester connecté.
            await signIn.RefreshSignInAsync(user);
            return Results.NoContent();
        }).RequireAuthorization();

        return g;
    }

    // Message volontairement identique (courriel inconnu OU mauvais mot de passe) :
    // on ne révèle pas quels comptes existent.
    private static IResult Identifiants() =>
        Results.Problem(statusCode: 401, title: "Connexion refusée", detail: "Courriel ou mot de passe invalide.");
}
