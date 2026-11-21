using System.Net;

namespace Naissances.Api.Courriels;

/// <summary>Contenu des courriels envoyés aux agents (texte brut + HTML simple, compatible tous clients).</summary>
internal static class ModelesCourriels
{
    private const string Application = "Registre des naissances";

    public static Courriel Reinitialisation(string destinataire, string lien, int validiteMinutes)
    {
        var texte = $"""
            Bonjour,

            Une demande de réinitialisation du mot de passe a été faite pour votre compte du {Application}.

            Pour choisir un nouveau mot de passe, ouvrez ce lien (valable {validiteMinutes} minutes, utilisable une seule fois) :
            {lien}

            Si vous n'êtes pas à l'origine de cette demande, ignorez ce courriel : votre mot de passe actuel reste valide.

            — {Application}
            """;

        var html = Gabarit("Réinitialisation du mot de passe", $"""
            <p>Bonjour,</p>
            <p>Une demande de réinitialisation du mot de passe a été faite pour votre compte du {Application}.</p>
            <p style="margin:24px 0">
              <a href="{WebUtility.HtmlEncode(lien)}"
                 style="background:#1d4e89;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
                Choisir un nouveau mot de passe
              </a>
            </p>
            <p>Ce lien est valable <strong>{validiteMinutes} minutes</strong> et ne peut servir qu'une seule fois.</p>
            <p style="color:#555">Si vous n'êtes pas à l'origine de cette demande, ignorez ce courriel :
              votre mot de passe actuel reste valide.</p>
            """);

        return new Courriel(destinataire, $"{Application} — réinitialisation du mot de passe", html, texte);
    }

    public static Courriel MotDePasseModifie(string destinataire, string urlSite)
    {
        var lienOubli = $"{urlSite.TrimEnd('/')}/mot-de-passe-oublie";
        var texte = $"""
            Bonjour,

            Le mot de passe de votre compte du {Application} vient d'être modifié.

            Si ce n'est pas vous, refaites immédiatement une demande de réinitialisation ({lienOubli})
            et prévenez votre responsable.

            — {Application}
            """;

        var html = Gabarit("Mot de passe modifié", $"""
            <p>Bonjour,</p>
            <p>Le mot de passe de votre compte du {Application} vient d'être modifié.</p>
            <p style="color:#555">Si ce n'est pas vous,
              <a href="{WebUtility.HtmlEncode(lienOubli)}">refaites immédiatement une demande de réinitialisation</a>
              et prévenez votre responsable.</p>
            """);

        return new Courriel(destinataire, $"{Application} — mot de passe modifié", html, texte);
    }

    private static string Gabarit(string titre, string corps) => $"""
        <!doctype html>
        <html lang="fr">
        <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
            <h1 style="font-size:20px;margin:0 0 16px">{titre}</h1>
            {corps}
            <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
            <p style="font-size:12px;color:#777">{Application} — courriel automatique, merci de ne pas y répondre.</p>
          </div>
        </body>
        </html>
        """;
}
