using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Naissances.Infrastructure.Persistance;

namespace Naissances.Api;

/// <summary>
/// Authentification par cookie (ASP.NET Core Identity) :
///  - le navigateur reçoit un cookie HttpOnly (illisible en JavaScript → protégé du XSS) ;
///  - SameSite=Strict : le cookie n'est jamais envoyé depuis un autre site (protection CSRF) ;
///  - en dev, Vite proxifie /api → même origine, donc aucun réglage CORS nécessaire.
/// Une API ne doit pas rediriger vers une page de login : on renvoie 401 / 403.
/// </summary>
internal static class Authentification
{
    public const int ValiditeLienMinutes = 30;

    public static IServiceCollection AjouterAuthentification(
        this IServiceCollection services, IConfiguration config, IHostEnvironment env)
    {
        // Cookie « Secure » (envoyé seulement en HTTPS) : obligatoire en production.
        // Désactivable pour docker compose en local (http://localhost:8080).
        var httpsObligatoire = config.GetValue("Authentification:CookieHttpsObligatoire", !env.IsDevelopment());

        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
        services.AddAuthorization();

        services.AddIdentityCore<IdentityUser>(o =>
            {
                o.User.RequireUniqueEmail = true;
                o.Password.RequiredLength = 10;
                o.Password.RequireDigit = true;
                o.Password.RequireLowercase = true;
                o.Password.RequireUppercase = true;
                o.Password.RequireNonAlphanumeric = true;
                // Verrouillage après 5 essais ratés : freine les attaques par force brute.
                o.Lockout.MaxFailedAccessAttempts = 5;
                o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            })
            .AddEntityFrameworkStores<NaissancesDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders() // jetons de réinitialisation du mot de passe
            .AddErrorDescriber<ErreursIdentiteFr>();

        // Lien « mot de passe oublié » : court et à usage unique (le jeton est lié au « security stamp »,
        // qui change dès que le mot de passe change). Chiffré par les clés Data Protection partagées.
        services.Configure<DataProtectionTokenProviderOptions>(o =>
            o.TokenLifespan = TimeSpan.FromMinutes(ValiditeLienMinutes));

        services.ConfigureApplicationCookie(o =>
        {
            o.Cookie.Name = "naissances.auth";
            o.Cookie.HttpOnly = true;
            o.Cookie.SameSite = SameSiteMode.Strict;
            o.Cookie.SecurePolicy = httpsObligatoire
                ? CookieSecurePolicy.Always
                : CookieSecurePolicy.SameAsRequest;
            o.ExpireTimeSpan = TimeSpan.FromHours(8);
            o.SlidingExpiration = true;
            o.Events = new CookieAuthenticationEvents
            {
                OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; },
                OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; },
            };
        });

        return services;
    }

    /// <summary>
    /// Crée le premier compte si "CompteInitial:Courriel" et "CompteInitial:MotDePasse" sont configurés
    /// (dotnet user-secrets en dev, variables d'application / Key Vault en production).
    /// Ne fait rien si le compte existe déjà : on peut le relancer sans risque.
    /// </summary>
    public static async Task CreerCompteInitialAsync(this IServiceProvider services, IConfiguration config, ILogger logger)
    {
        var courriel = config["CompteInitial:Courriel"];
        var motDePasse = config["CompteInitial:MotDePasse"];
        if (string.IsNullOrWhiteSpace(courriel) || string.IsNullOrWhiteSpace(motDePasse)) return;

        using var scope = services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
        if (await users.FindByEmailAsync(courriel) is not null) return;

        var resultat = await users.CreateAsync(
            new IdentityUser { UserName = courriel, Email = courriel, EmailConfirmed = true }, motDePasse);

        if (resultat.Succeeded)
            logger.LogInformation("Compte initial {Courriel} créé.", courriel);
        else
            logger.LogError("Compte initial non créé : {Erreurs}",
                string.Join(" ", resultat.Errors.Select(e => e.Description)));
    }
}

/// <summary>Messages d'Identity en français (affichés tels quels par le frontend).</summary>
internal sealed class ErreursIdentiteFr : IdentityErrorDescriber
{
    public override IdentityError PasswordMismatch() =>
        new() { Code = nameof(PasswordMismatch), Description = "Le mot de passe actuel est incorrect." };
    public override IdentityError PasswordTooShort(int length) =>
        new() { Code = nameof(PasswordTooShort), Description = $"Au moins {length} caractères." };
    public override IdentityError PasswordRequiresDigit() =>
        new() { Code = nameof(PasswordRequiresDigit), Description = "Au moins un chiffre." };
    public override IdentityError PasswordRequiresLower() =>
        new() { Code = nameof(PasswordRequiresLower), Description = "Au moins une minuscule." };
    public override IdentityError PasswordRequiresUpper() =>
        new() { Code = nameof(PasswordRequiresUpper), Description = "Au moins une majuscule." };
    public override IdentityError PasswordRequiresNonAlphanumeric() =>
        new() { Code = nameof(PasswordRequiresNonAlphanumeric), Description = "Au moins un caractère spécial." };
    public override IdentityError DuplicateEmail(string email) =>
        new() { Code = nameof(DuplicateEmail), Description = $"Le courriel {email} est déjà utilisé." };
    public override IdentityError InvalidToken() =>
        new() { Code = nameof(InvalidToken), Description = MessageLienInvalide };

    public const string MessageLienInvalide =
        "Ce lien n’est plus valide (expiré ou déjà utilisé). Faites une nouvelle demande.";
}
