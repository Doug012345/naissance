using Microsoft.EntityFrameworkCore;
using Naissances.Application.Abstractions;
using Naissances.Application.Naissances;
using Naissances.Domain.Naissances;

namespace Naissances.Infrastructure.Persistance;

internal sealed class NaissanceRepository(NaissancesDbContext db) : INaissanceRepository
{
    public void Ajouter(Naissance naissance) => db.Naissances.Add(naissance);

    public Task<Naissance?> ObtenirAsync(Guid id, CancellationToken ct) =>
        db.Naissances.FirstOrDefaultAsync(n => n.Id == id, ct);

    public void DefinirVersionAttendue(Naissance naissance, byte[] version) =>
        db.Entry(naissance).Property(n => n.Version).OriginalValue = version;

    public async Task SauvegarderAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrenceException();
        }
    }
}

/// <summary>Côté lecture : AsNoTracking + projection SQL directe en DTO.</summary>
internal sealed class LectureNaissances(NaissancesDbContext db) : ILectureNaissances
{
    public async Task<PageResultat<NaissanceResumeDto>> RechercherAsync(RechercheNaissances r, CancellationToken ct)
    {
        var query = db.Naissances.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(r.Recherche))
        {
            var motif = $"%{r.Recherche.Trim()}%";
            query = query.Where(n =>
                EF.Functions.Like(n.Enfant.Nom, motif) ||
                EF.Functions.Like(n.Enfant.Prenom, motif) ||
                EF.Functions.Like(n.NumeroActe, motif));
        }

        if (r.Statut is not null)
            query = query.Where(n => n.Statut == r.Statut);

        var total = await query.CountAsync(ct);

        var elements = await query
            .OrderByDescending(n => n.DateHeureNaissance)
            .Skip((r.PageNormalisee - 1) * r.TailleNormalisee)
            .Take(r.TailleNormalisee)
            .Select(n => new NaissanceResumeDto(
                n.Id, n.NumeroActe, n.Enfant.Prenom + " " + n.Enfant.Nom,
                n.Sexe, n.DateHeureNaissance, n.Ville, n.Statut))
            .ToListAsync(ct);

        return new PageResultat<NaissanceResumeDto>(elements, r.PageNormalisee, r.TailleNormalisee, total);
    }

    public async Task<NaissanceDetailDto?> ObtenirDetailAsync(Guid id, CancellationToken ct)
    {
        var n = await db.Naissances.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (n is null) return null;

        return new NaissanceDetailDto(
            n.Id, n.NumeroActe, n.Enfant.Prenom, n.Enfant.Nom, n.Sexe, n.DateHeureNaissance,
            n.Etablissement, n.Ville, n.PoidsGrammes, n.TailleCm,
            new ParentDto(n.Mere.Identite.Prenom, n.Mere.Identite.Nom, n.Mere.DateNaissance),
            n.SecondParent is null ? null
                : new ParentDto(n.SecondParent.Identite.Prenom, n.SecondParent.Identite.Nom, n.SecondParent.DateNaissance),
            n.Statut, n.MotifAnnulation, n.DateEnregistrementUtc,
            Convert.ToBase64String(n.Version));
    }
}

internal sealed class GenerateurNumeroActe(NaissancesDbContext db) : IGenerateurNumeroActe
{
    public async Task<string> ProchainAsync(int annee, CancellationToken ct)
    {
        // SQL Server interdit NEXT VALUE FOR dans une sous-requête. SingleAsync() ferait composer
        // EF (SELECT TOP(2) ... FROM (<sql>) AS t) -> erreur. ToListAsync() exécute le SQL tel quel.
        var valeurs = await db.Database
            .SqlQuery<long>($"SELECT NEXT VALUE FOR etatcivil.NumeroActeSequence AS [Value]")
            .ToListAsync(ct);
        var valeur = valeurs.Single();

        return $"N-{annee}-{valeur:D6}";
    }
}
