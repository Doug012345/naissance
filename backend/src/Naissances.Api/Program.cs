using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Naissances.Api;
using Naissances.Api.Endpoints;
using Naissances.Application.Naissances;
using Naissances.Infrastructure;
using Naissances.Infrastructure.Persistance;

var builder = WebApplication.CreateBuilder(args);

// Composition root : SEUL endroit qui connaît toutes les couches.
builder.Services.AjouterInfrastructure(builder.Configuration);
builder.Services.AddScoped<EnregistrerNaissance>();
builder.Services.AddScoped<AnnulerNaissance>();
builder.Services.AddSingleton(TimeProvider.System);

// Enums en texte ("Feminin") : plus lisible côté React que 1/2/3.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GestionErreurs>();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // /openapi/v1.json
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<NaissancesDbContext>().Database.MigrateAsync();
}

// En dev, Vite proxifie /api vers ce serveur : pas besoin de CORS.
app.MapNaissances();
app.MapGet("/health", () => Results.Ok("OK"));

app.Run();

public partial class Program; // pour WebApplicationFactory dans les tests d'intégration
