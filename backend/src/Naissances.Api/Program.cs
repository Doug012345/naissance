using System.Text.Json.Serialization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Naissances.Api;
using Naissances.Api.Courriels;
using Naissances.Api.Endpoints;
using Naissances.Application.Naissances;
using Naissances.Infrastructure;
using Naissances.Infrastructure.Persistance;

var builder = WebApplication.CreateBuilder(args);

// Composition root : SEUL endroit qui connaît toutes les couches.
builder.Services.AjouterInfrastructure(builder.Configuration);
builder.Services.AddScoped<EnregistrerNaissance>();
builder.Services.AddScoped<AnnulerNaissance>();
builder.Services.AddScoped<DelivrerCertificat>();
builder.Services.AddScoped<RectifierNaissance>();
builder.Services.AddScoped<TelechargerCertificat>();
builder.Services.AjouterLimiteVerification();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AjouterAuthentification(builder.Configuration, builder.Environment);
builder.Services.AjouterCourriels(builder.Configuration); // « mot de passe oublié » (Resend)

// Clés qui chiffrent le cookie de connexion, rangées dans la base SQL (table DataProtectionKeys).
// Un conteneur a un disque jetable et Azure peut l'éteindre (0 réplica) ou en lancer plusieurs :
// sans clés partagées et persistantes, chaque redémarrage déconnecterait tout le monde.
builder.Services.AddDataProtection()
    .SetApplicationName("naissances")
    .PersistKeysToDbContext<NaissancesDbContext>();

// Enums en texte ("Feminin") : plus lisible côté React que 1/2/3.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GestionErreurs>();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
    app.MapOpenApi(); // /openapi/v1.json

// Migrations + compte initial au démarrage : toujours en dev, et ailleurs (Docker, Azure)
// seulement si Demarrage:AppliquerMigrations=true.
if (app.Configuration.GetValue("Demarrage:AppliquerMigrations", app.Environment.IsDevelopment()))
{
    using (var scope = app.Services.CreateScope())
        await scope.ServiceProvider.GetRequiredService<NaissancesDbContext>().Database.MigrateAsync();
    await app.Services.CreerCompteInitialAsync(app.Configuration, app.Logger);
}

// En dev, Vite proxifie /api vers ce serveur : pas besoin de CORS.
app.MapAuth();
app.MapNaissances();
app.MapVerification();
app.MapGet("/health", () => Results.Ok("OK"));

app.Run();

public partial class Program; // pour WebApplicationFactory dans les tests d'intégration
