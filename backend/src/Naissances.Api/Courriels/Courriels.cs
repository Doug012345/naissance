using System.Net.Http.Headers;
using System.Threading.Channels;

namespace Naissances.Api.Courriels;

public sealed record Courriel(string Destinataire, string Sujet, string Html, string Texte);

/// <summary>Envoie réellement un courriel (Resend en production, journal en local).</summary>
public interface IEnvoiCourriel
{
    Task EnvoyerAsync(Courriel courriel, CancellationToken ct);
}

/// <summary>
/// File d'attente en mémoire : la requête HTTP ne fait que DÉPOSER le courriel, un service
/// d'arrière-plan l'envoie. Deux avantages :
///  - la réponse « mot de passe oublié » prend le même temps que le compte existe ou non
///    (impossible de deviner quels courriels sont inscrits en chronométrant) ;
///  - une panne passagère de Resend ne fait pas échouer la demande de l'utilisateur.
/// </summary>
public sealed class FileCourriels
{
    private readonly Channel<Courriel> _canal = Channel.CreateBounded<Courriel>(
        new BoundedChannelOptions(100) { FullMode = BoundedChannelFullMode.DropWrite });

    public bool Deposer(Courriel courriel) => _canal.Writer.TryWrite(courriel);

    internal ChannelReader<Courriel> Lecteur => _canal.Reader;
}

internal sealed class EnvoiCourrielsEnArrierePlan(
    FileCourriels file, IEnvoiCourriel envoi, ILogger<EnvoiCourrielsEnArrierePlan> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var courriel in file.Lecteur.ReadAllAsync(stoppingToken))
        {
            // 3 essais espacés : couvre un incident réseau ou une limite de débit passagère.
            for (var essai = 1; essai <= 3; essai++)
            {
                try
                {
                    await envoi.EnvoyerAsync(courriel, stoppingToken);
                    break;
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    // Jamais l'adresse ni le contenu (lien secret) dans les journaux.
                    log.LogWarning(e, "Échec d'envoi du courriel « {Sujet} » (essai {Essai}/3).", courriel.Sujet, essai);
                    if (essai < 3) await Task.Delay(TimeSpan.FromSeconds(5 * essai), stoppingToken);
                }
            }
        }
    }
}

/// <summary>Envoi par l'API HTTP de Resend (https://resend.com/docs/api-reference/emails/send-email).</summary>
internal sealed class EnvoiResend(IHttpClientFactory fabrique, string expediteur) : IEnvoiCourriel
{
    public async Task EnvoyerAsync(Courriel courriel, CancellationToken ct)
    {
        using var reponse = await fabrique.CreateClient("resend").PostAsJsonAsync("emails", new
        {
            from = expediteur,
            to = new[] { courriel.Destinataire },
            subject = courriel.Sujet,
            html = courriel.Html,
            text = courriel.Texte,
        }, ct);

        if (!reponse.IsSuccessStatusCode)
            throw new HttpRequestException(
                $"Resend a répondu {(int)reponse.StatusCode} : {await reponse.Content.ReadAsStringAsync(ct)}");
    }
}

/// <summary>
/// Sans clé Resend (développement, docker compose) : rien n'est envoyé.
/// Le contenu (avec le lien) n'est écrit dans le journal QUE si Courriel:JournaliserContenu=true,
/// pour pouvoir tester en local. Jamais en production : le lien donne accès au compte.
/// </summary>
internal sealed class EnvoiJournal(ILogger<EnvoiJournal> log, bool journaliserContenu) : IEnvoiCourriel
{
    public Task EnvoyerAsync(Courriel courriel, CancellationToken ct)
    {
        if (journaliserContenu)
            log.LogInformation("Courriel NON envoyé (mode local) à {Destinataire} : {Sujet}\n{Texte}",
                courriel.Destinataire, courriel.Sujet, courriel.Texte);
        else
            log.LogWarning("Courriel « {Sujet} » NON envoyé : Courriel:ResendCleApi n'est pas configurée.", courriel.Sujet);
        return Task.CompletedTask;
    }
}

internal static class CourrielsExtensions
{
    public static IServiceCollection AjouterCourriels(this IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton<FileCourriels>();
        services.AddHostedService<EnvoiCourrielsEnArrierePlan>();

        var cle = config["Courriel:ResendCleApi"];
        if (string.IsNullOrWhiteSpace(cle))
        {
            var journaliser = config.GetValue("Courriel:JournaliserContenu", false);
            services.AddSingleton<IEnvoiCourriel>(sp =>
                new EnvoiJournal(sp.GetRequiredService<ILogger<EnvoiJournal>>(), journaliser));
            return services;
        }

        var expediteur = config["Courriel:Expediteur"]
                         ?? throw new InvalidOperationException("Courriel:Expediteur manquant.");
        services.AddHttpClient("resend", http =>
        {
            http.BaseAddress = new Uri("https://api.resend.com/");
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", cle);
            http.Timeout = TimeSpan.FromSeconds(15);
        });
        // Client recréé à chaque envoi via la fabrique : rotation normale des connexions (DNS).
        services.AddSingleton<IEnvoiCourriel>(sp => new EnvoiResend(
            sp.GetRequiredService<IHttpClientFactory>(), expediteur));
        return services;
    }
}
