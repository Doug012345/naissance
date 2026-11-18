using Naissances.Application.Naissances;
using Naissances.Domain.Naissances;

namespace Naissances.Application.Abstractions;

/// <summary>Écriture : on charge/sauvegarde l'agrégat complet.</summary>
public interface INaissanceRepository
{
    void Ajouter(Naissance naissance);
    Task<Naissance?> ObtenirAsync(Guid id, CancellationToken ct);

    /// <summary>Indique la version que le client avait affichée (concurrence optimiste).</summary>
    void DefinirVersionAttendue(Naissance naissance, byte[] version);

    /// <exception cref="ConcurrenceException">Si quelqu'un a modifié l'enregistrement entre-temps.</exception>
    Task SauvegarderAsync(CancellationToken ct);
}

/// <summary>Lecture : projections directes en DTO (CQRS « léger »), sans charger l'agrégat.</summary>
public interface ILectureNaissances
{
    Task<PageResultat<NaissanceResumeDto>> RechercherAsync(RechercheNaissances requete, CancellationToken ct);
    Task<NaissanceDetailDto?> ObtenirDetailAsync(Guid id, CancellationToken ct);
}

/// <summary>Numéro d'acte unique : N-2026-000123 (séquence SQL Server).</summary>
public interface IGenerateurNumeroActe
{
    Task<string> ProchainAsync(int annee, CancellationToken ct);
}

public sealed class IntrouvableException(string message) : Exception(message);

public sealed class ConcurrenceException() :
    Exception("L'enregistrement a été modifié par un autre utilisateur. Rechargez la page.");
