using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Naissances.Api.Courriels;

namespace Naissances.Api.Endpoints;

public sealed record ConnexionRequete(string Courriel, string MotDePasse);
public sealed record ChangerMotDePasseRequete(string MotDePasseActuel, string NouveauMotDePasse);
public sealed record MotDePasseOublieRequete(string Courriel);
public sealed record ReinitialisationRequete(string UtilisateurId, string Jeton, string NouveauMotDePasse);
public sealed record UtilisateurDto(string Courriel);

/// <summary>
///   POST /api/auth/connexion           -> 200 + cookie | 401
///   POST /api/auth/deconnexion         -> 204
///   GET  /api/auth/moi                 -> 200 | 401   (le frontend sait s'il est connecté)
///   POST /api/auth/mot-de-passe        -> 204 | 422 errors { motDePasseActuel | nouveauMotDePasse }
///   POST /api/auth/mot-de-passe-oublie -> 202 TOUJOURS (compte existant ou non) | 429
///   POST /api/auth/reinitialisation    -> 204 | 422 errors { jeton | nouveauMotDePasse } | 429
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

        g.MapPost("/mot-de-passe-oublie", DemanderReinitialisation)
         .AllowAnonymous().RequireRateLimiting(PolitiqueMotDePasseOublie);

        g.MapPost("/reinitialisation", Reinitialiser)
         .AllowAnonymous().RequireRateLimiting(VerificationEndpoints.PolitiqueLimite);

        return g;
    }

    private static async Task<IResult> DemanderReinitialisation(MotDePasseOublieRequete req,
        UserManager<IdentityUser> users, FileCourriels courriels, IConfiguration config)
    {
        var user = await users.FindByEmailAsync(req.Courriel?.Trim() ?? "");
        if (user?.Email is not null)
        {
            var jeton = WebEncoders.Base64UrlEncode(
                Encoding.UTF8.GetBytes(await users.GeneratePasswordResetTokenAsync(user)));
            // Le jeton est dans le FRAGMENT (#…) : le navigateur ne l'envoie jamais au serveur,
            // il n'apparaît donc ni dans les journaux nginx, ni dans l'en-tête Referer.
            var lien = $"{UrlSite(config)}/reinitialiser-mot-de-passe#id={Uri.EscapeDataString(user.Id)}&jeton={jeton}";
            courriels.Deposer(ModelesCourriels.Reinitialisation(user.Email, lien, Authentification.ValiditeLienMinutes));
        }

        // Toujours la même réponse : on ne révèle pas quels courriels ont un compte.
        return Results.Accepted();
    }

    private static async Task<IResult> Reinitialiser(ReinitialisationRequete req,
        UserManager<IdentityUser> users, FileCourriels courriels, IConfiguration config)
    {
        var user = await users.FindByIdAsync(req.UtilisateurId ?? "");
        if (user is null || Decoder(req.Jeton) is not { } jeton)
            return Erreurs(new Dictionary<string, string[]> { ["jeton"] = [ErreursIdentiteFr.MessageLienInvalide] });

        var resultat = await users.ResetPasswordAsync(user, jeton, req.NouveauMotDePasse ?? "");
        if (!resultat.Succeeded)
            return Erreurs(resultat.Errors
                .GroupBy(e => e.Code == nameof(IdentityErrorDescriber.InvalidToken) ? "jeton" : "nouveauMotDePasse")
                .ToDictionary(gr => gr.Key, gr => gr.Select(e => e.Description).ToArray()));

        // Le propriétaire a prouvé l'accès à sa boîte courriel : on lève un éventuel verrouillage.
        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);
        // Avertit le titulaire : si ce n'était pas lui, il le saura tout de suite.
        if (user.Email is not null)
            courriels.Deposer(ModelesCourriels.MotDePasseModifie(user.Email, UrlSite(config)));
        return Results.NoContent();
    }

    public const string PolitiqueMotDePasseOublie = "mot-de-passe-oublie";

    private static string UrlSite(IConfiguration config) =>
        (config["Certificat:UrlSite"] ?? throw new InvalidOperationException("Certificat:UrlSite manquant.")).TrimEnd('/');

    private static string? Decoder(string? jeton)
    {
        try { return string.IsNullOrWhiteSpace(jeton) ? null : Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(jeton)); }
        catch (FormatException) { return null; }
    }

    private static IResult Erreurs(Dictionary<string, string[]> errors) =>
        Results.ValidationProblem(errors, statusCode: 422,
            title: "Mot de passe non réinitialisé", detail: errors.Values.First()[0]);

    // Message volontairement identique (courriel inconnu OU mauvais mot de passe) :
    // on ne révèle pas quels comptes existent.
    private static IResult Identifiants() =>
        Results.Problem(statusCode: 401, title: "Connexion refusée", detail: "Courriel ou mot de passe invalide.");
}
