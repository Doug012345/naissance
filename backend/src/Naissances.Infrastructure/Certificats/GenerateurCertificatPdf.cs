using System.Globalization;
using System.Text;
using Naissances.Application.Abstractions;
using Naissances.Application.Naissances;
using Naissances.Domain.Naissances;
using QRCoder;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Naissances.Infrastructure.Certificats;

/// <summary>
/// Certificat de naissance en PDF (A4, vectoriel : texte net et sélectionnable), même contenu que la
/// version imprimable du site : en-tête « Commune de … », données de l'acte, sceau, QR code de
/// vérification, fond guilloché, micro-texte et filigrane « ANNULÉ » si l'acte est annulé.
///
/// QuestPDF : licence « Community » gratuite (particulier ou organisation &lt; 1 M$ US de revenus,
/// HORS organismes publics) — voir README. Police Lato embarquée dans le paquet : aucune police
/// à installer dans le conteneur Linux.
/// </summary>
public sealed class GenerateurCertificatPdf : IGenerateurCertificatPdf
{
    private const string Encre = "#1D3A7A";
    private const string Trait = "#C9D3E8";
    private static readonly string[] Mois =
        ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
         "septembre", "octobre", "novembre", "décembre"];

    private readonly string _urlSite;
    private readonly TimeZoneInfo _fuseau;

    static GenerateurCertificatPdf() => QuestPDF.Settings.License = LicenseType.Community;

    /// <param name="urlSite">Adresse publique du site (ex. https://naissance.anmbo.ca), pour le QR code.</param>
    public GenerateurCertificatPdf(string urlSite)
    {
        _urlSite = urlSite.TrimEnd('/');
        _fuseau = TrouverFuseau();
    }

    public byte[] Generer(NaissanceDetailDto n, DelivranceDto d)
    {
        var code = CodeVerification.Formater(n.CodeVerification);
        var urlVerification = $"{_urlSite}/verifier/{code}";
        var hote = new Uri(_urlSite).Authority; // hôte (+ port s'il n'est pas standard)
        var annule = n.Statut == StatutNaissance.Annulee;
        var microTexte = string.Concat(Enumerable.Repeat(
            $"COMMUNE DE {n.Commune.ToUpperInvariant()} · CERTIFICAT DE NAISSANCE · ACTE {n.NumeroActe} · ", 8));

        return Document.Create(doc => doc.Page(page =>
        {
            // Cadre et fond dessinés en arrière-plan (10 mm du bord) ; le texte est mis en page par-dessus :
            // en-tête en haut, pied (sceau, signature, QR) toujours en bas de la feuille.
            page.Size(PageSizes.A4);
            page.MarginVertical(18, Unit.Millimetre);
            page.MarginHorizontal(24, Unit.Millimetre);
            page.PageColor(Colors.White);
            page.DefaultTextStyle(t => t.FontFamily("Lato").FontSize(11).FontColor("#1B1B1B"));

            page.Background().Padding(10, Unit.Millimetre)
                .Border(2.5f).BorderColor(Encre).Background("#FFFDF7")
                .Svg(_ => FondGuilloche());

            page.Header().Text(microTexte).FontSize(4).FontColor(Encre).ClampLines(1);

            page.Content().Column(col =>
                        {
                            // En-tête
                            col.Item().PaddingTop(14, Unit.Millimetre).AlignCenter()
                               .Text($"Commune de {n.Commune}".ToUpperInvariant())
                               .FontSize(18).Bold().LetterSpacing(0.05f).FontColor(Encre);
                            col.Item().AlignCenter().Text("Service de l’état civil").Italic().FontColor("#444444");
                            col.Item().PaddingTop(8).BorderTop(1).BorderBottom(1).BorderColor(Encre)
                               .PaddingVertical(6).AlignCenter()
                               .Text("CERTIFICAT DE NAISSANCE").FontSize(24).LetterSpacing(0.12f).FontColor(Encre);
                            col.Item().PaddingTop(6).AlignCenter().Text($"Acte n° {n.NumeroActe}").Bold();

                            // Données de l'acte
                            col.Item().PaddingTop(12, Unit.Millimetre).Table(t =>
                            {
                                t.ColumnsDefinition(c => { c.ConstantColumn(170); c.RelativeColumn(); });
                                void Ligne(string libelle, string valeur)
                                {
                                    t.Cell().PaddingVertical(7).Text(libelle).Bold().FontColor(Encre);
                                    t.Cell().PaddingVertical(7).BorderBottom(0.5f).BorderColor("#999999").Text(valeur);
                                }

                                Ligne("Nom", n.Nom);
                                Ligne("Prénom(s)", n.Prenom);
                                Ligne("Sexe", Libelle(n.Sexe));
                                Ligne("Date et heure de naissance", DateHeure(n.DateHeureNaissance));
                                Ligne("Lieu de naissance", $"{n.Etablissement}, {n.Ville}");
                                Ligne("Mère", $"{n.Mere.Prenom} {n.Mere.Nom}, née le {Date(n.Mere.DateNaissance)}");
                                if (n.SecondParent is { } sp)
                                    Ligne("Second parent", $"{sp.Prenom} {sp.Nom}, né(e) le {Date(sp.DateNaissance)}");
                                Ligne("Acte enregistré le", Date(DateOnly.FromDateTime(Local(n.DateEnregistrementUtc))));
                                if (n.DateDerniereRectificationUtc is { } rect)
                                    Ligne("Acte rectifié le", Date(DateOnly.FromDateTime(Local(rect))));
                            });
            });

            page.Footer().Column(col =>
                        {
                            col.Item().PaddingBottom(8, Unit.Millimetre).AlignCenter()
                               .Text($"Certifié conforme aux registres de l’état civil de la commune de {n.Commune}.")
                               .Italic();

                            // Pied : sceau | signature | QR code
                            col.Item().Row(row =>
                            {
                                row.ConstantItem(120).Rotate(-8).Element(c => Sceau(c, n.Commune));

                                row.RelativeItem().PaddingHorizontal(10).AlignBottom().Column(sig =>
                                {
                                    sig.Item().AlignCenter()
                                       .Text($"Délivré à {n.Commune}, le {Date(DateOnly.FromDateTime(Local(d.DateDelivranceUtc)))}");
                                    sig.Item().AlignCenter().Text($"Copie n° {d.NumeroCopie}").Bold();
                                    sig.Item().PaddingTop(30).PaddingHorizontal(25).BorderBottom(1).BorderColor("#333333");
                                    sig.Item().PaddingTop(3).AlignCenter().Text("L’officier de l’état civil");
                                    sig.Item().AlignCenter().Text($"Réf. agent : {d.DelivrePar}").FontSize(8).FontColor("#555555");
                                });

                                row.ConstantItem(110).AlignBottom().Column(qr =>
                                {
                                    qr.Item().AlignCenter().Width(80).Height(80).Svg(_ => QrCode(urlVerification));
                                    qr.Item().PaddingTop(4).AlignCenter().Text(t =>
                                    {
                                        t.Span("Code : ").FontSize(8);
                                        t.Span(code).FontSize(9).Bold().LetterSpacing(0.08f);
                                    });
                                    qr.Item().AlignCenter().Text("Vérifier l’authenticité :").FontSize(7.5f);
                                    qr.Item().AlignCenter().Text($"{hote}/verifier").FontSize(7.5f);
                                });
                            });

                            col.Item().PaddingTop(8).Text(microTexte).FontSize(4).FontColor(Encre).ClampLines(1);
                        });

            if (annule)
            {
                page.Foreground().AlignCenter().AlignMiddle().Rotate(-30)
                    .Border(6).BorderColor("#47B3261E").PaddingHorizontal(16).PaddingVertical(4)
                    .Text("ANNULÉ").FontSize(80).Bold().LetterSpacing(0.1f).FontColor("#47B3261E");
            }
        })).WithMetadata(new DocumentMetadata
        {
            Title = $"Certificat de naissance — acte {n.NumeroActe} — copie {d.NumeroCopie}",
            Author = $"Commune de {n.Commune} — Service de l’état civil",
            Creator = "Registre des naissances"
        }).GeneratePdf();
    }

    // ───────────── Sceau : anneaux en SVG, lettres posées une à une sur le cercle ─────────────

    private static void Sceau(IContainer conteneur, string commune)
    {
        const float taille = 120, centre = taille / 2;
        var haut = $"COMMUNE DE {commune.ToUpperInvariant()}";
        // L'arc du haut ne dépasse pas ~150° : on réduit la police pour les noms de commune longs.
        var police = Math.Clamp(46f * 2.6f / Largeur(haut), 5f, 8.5f);

        conteneur.Width(taille).Height(taille).Layers(l =>
        {
            l.PrimaryLayer().Svg(_ => $"""
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {taille} {taille}">
                  <g fill="none" stroke="{Encre}">
                    <circle cx="{centre}" cy="{centre}" r="57" stroke-width="2.2"/>
                    <circle cx="{centre}" cy="{centre}" r="54" stroke-width="0.6"/>
                    <circle cx="{centre}" cy="{centre}" r="37.5" stroke-width="1.1"/>
                    <circle cx="{centre}" cy="{centre}" r="34.5" stroke-width="0.5" stroke-dasharray="1.5 1.5"/>
                  </g>
                  <g fill="{Encre}">
                    {Etoile(centre, 42, 5.5f)}
                    {Etoile(centre - 9, 81, 2.6f)}{Etoile(centre, 81, 2.6f)}{Etoile(centre + 9, 81, 2.6f)}
                  </g>
                </svg>
                """);

            ArcDeTexte(l, haut, centre, rayon: 46, police, enHaut: true);
            ArcDeTexte(l, "• ÉTAT CIVIL •", centre, rayon: 46, 8, enHaut: false);

            l.Layer().AlignCenter().PaddingTop(49).Text("CERTIFIÉ").FontSize(8).Bold().FontColor(Encre);
            l.Layer().AlignCenter().PaddingTop(59).Text("CONFORME").FontSize(8).Bold().FontColor(Encre);
        });
    }

    /// <summary>
    /// Pose chaque lettre sur le cercle, tournée selon la tangente (QuestPDF n'a pas de « texte sur chemin »).
    /// En haut : de gauche à droite, le haut des lettres vers l'extérieur ; en bas : lisible à l'endroit.
    /// </summary>
    private static void ArcDeTexte(LayersDescriptor l, string texte, float centre, float rayon, float police, bool enHaut)
    {
        var longueur = Largeur(texte) * police; // longueur de l'arc occupée par le texte
        var cumul = 0f;

        foreach (var lettre in texte)
        {
            var largeur = Largeur(lettre) * police;
            // Abscisse du milieu de la lettre sur l'arc, centrée sur le haut (ou le bas) du cercle.
            var decalage = (cumul + largeur / 2 - longueur / 2) / rayon;
            cumul += largeur;
            if (lettre == ' ') continue;

            // Angle mesuré depuis l'axe des x, y vers le bas : 270° = haut du cercle, 90° = bas.
            var angle = enHaut ? 3 * Math.PI / 2 + decalage : Math.PI / 2 - decalage;
            var x = centre + rayon * (float)Math.Cos(angle);
            var y = centre + rayon * (float)Math.Sin(angle);
            var rotation = (float)((angle - (enHaut ? 3 * Math.PI / 2 : Math.PI / 2)) * 180 / Math.PI);

            // Rotation autour du coin haut-gauche : on recentre ensuite la lettre sur le point du cercle.
            l.Layer().Unconstrained().OffsetX(x).OffsetY(y).Rotate(rotation)
             .OffsetX(-largeur / 2).OffsetY(-police * 0.62f)
             .Text(lettre.ToString()).FontSize(police).Bold().FontColor(Encre);
        }
    }

    /// <summary>Largeur approximative d'une capitale Lato grasse, en fraction de la taille de police.</summary>
    private static float Largeur(char c) => c switch
    {
        'I' or '.' or '\'' or '’' => 0.32f,
        ' ' => 0.38f,
        '-' or '•' => 0.45f,
        'J' or 'L' or 'F' or 'T' or 'E' or 'É' or 'È' or 'Ê' or 'S' => 0.6f,
        'M' or 'W' => 0.9f,
        'O' or 'Q' or 'C' or 'D' or 'G' or 'N' or 'H' or 'U' or 'Ô' => 0.76f,
        _ => 0.68f
    } + 0.06f; // + espacement entre les lettres

    private static float Largeur(string texte) => texte.Sum(Largeur);

    private static string Etoile(float cx, float cy, float r)
    {
        var points = new StringBuilder();
        for (var k = 0; k < 10; k++)
        {
            var a = -Math.PI / 2 + k * Math.PI / 5;
            var rr = k % 2 == 0 ? r : r * 0.42;
            points.Append(Inv(cx + rr * Math.Cos(a))).Append(',').Append(Inv(cy + rr * Math.Sin(a))).Append(' ');
        }
        return $"""<polygon points="{points.ToString().Trim()}"/>""";
    }

    // ───────────── QR code vectoriel : un carré par module ─────────────

    private static string QrCode(string texte)
    {
        using var generateur = new QRCodeGenerator();
        using var donnees = generateur.CreateQrCode(texte, QRCodeGenerator.ECCLevel.M);
        var matrice = donnees.ModuleMatrix;
        var n = matrice.Count;
        var svg = new StringBuilder($"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges"><path fill="#000000" d=" """);
        for (var y = 0; y < n; y++)
            for (var x = 0; x < n; x++)
                if (matrice[y][x]) svg.Append($"M{x},{y}h1v1h-1z");
        return svg.Append("\"/></svg>").ToString();
    }

    // ───────────── Fond guilloché (mêmes ondes que la version HTML) ─────────────

    private static string FondGuilloche()
    {
        var svg = new StringBuilder(
            $"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 850" preserveAspectRatio="none"><g fill="none" stroke="{Trait}" stroke-width="0.6" opacity="0.55">""");
        for (var i = 0; i < 50; i++)
        {
            var y0 = 20 + i * 16;
            var amplitude = 6 + i % 3 * 2;
            var phase = i * 0.7;
            svg.Append("<path d=\"");
            for (var k = 0; k <= 60; k++)
                svg.Append(k == 0 ? 'M' : 'L').Append(k * 10).Append(',')
                   .Append(Inv(y0 + amplitude * Math.Sin(k / 3.0 + phase))).Append(' ');
            svg.Append("\"/>");
        }
        return svg.Append("</g></svg>").ToString();
    }

    // ───────────── Formats français (indépendants de la culture du conteneur) ─────────────

    private static string Inv(double v) => v.ToString("0.##", CultureInfo.InvariantCulture);

    private static string Date(DateOnly d) => $"{(d.Day == 1 ? "1er" : d.Day.ToString(CultureInfo.InvariantCulture))} {Mois[d.Month - 1]} {d.Year}";

    private static string DateHeure(DateTime d) =>
        $"{Date(DateOnly.FromDateTime(d))} à {d.Hour} h {d.Minute:00}";

    private static string Libelle(Sexe s) => s switch
    {
        Sexe.Feminin => "Féminin",
        Sexe.Masculin => "Masculin",
        _ => "Indéterminé"
    };

    private DateTime Local(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), _fuseau);

    /// <summary>Heure du Québec ; UTC si le fuseau est introuvable (conteneur sans tzdata).</summary>
    private static TimeZoneInfo TrouverFuseau()
    {
        foreach (var id in new[] { "America/Toronto", "Eastern Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }
}
