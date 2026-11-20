using Naissances.Application.Naissances;
using Naissances.Domain.Naissances;

namespace Naissances.Application.Abstractions;

/// <summary>Écriture : on charge/sauvegarde l'agrégat complet.</summary>
public interface INaissanceRepository
{
    void Ajouter(Naissance naissance);
    Task<Naissance?> ObtenirAsync(Guid id, CancellationToken ct);

    /// <summary>Nombre de copies du certificat déjà délivrées pour cette naissance.</summary>
    Task<int> CompterDelivrancesAsync(Guid naissanceId, CancellationToken ct);
    void AjouterDelivrance(DelivranceCertificat delivrance);
    void AjouterRectification(RectificationNaissance rectification);

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

    /// <param name="code">Code déjà normalisé (voir CodeVerification.Normaliser).</param>
    Task<VerificationDto?> VerifierAsync(string code, CancellationToken ct);

    /// <summary>Historique des rectifications, la plus récente en premier.</summary>
    Task<IReadOnlyList<RectificationDto>> ListerRectificationsAsync(Guid naissanceId, CancellationToken ct);
}

/// <summary>Fabrique le PDF du certificat (implémenté avec QuestPDF dans l'infrastructure).</summary>
public interface IGenerateurCertificatPdf
{
    byte[] Generer(NaissanceDetailDto naissance, DelivranceDto delivrance);
}

/// <summary>Numéro d'acte unique : N-2026-000123 (séquence SQL Server).</summary>
public interface IGenerateurNumeroActe
{
    Task<string> ProchainAsync(int annee, CancellationToken ct);
}

public sealed class IntrouvableException(string message) : Exception(message);

public sealed class ConcurrenceException() :
    Exception("L'enregistrement a été modifié par un autre utilisateur. Rechargez la page.");
