using Naissances.Domain.Communs;

namespace Naissances.Domain.Naissances;

/// <summary>
/// Journal d'audit : chaque impression d'un certificat est une « copie » numérotée
/// (qui l'a délivrée, quand). Le numéro de copie est imprimé sur le certificat.
/// </summary>
public sealed class DelivranceCertificat
{
    public Guid Id { get; private set; }
    public Guid NaissanceId { get; private set; }
    public int NumeroCopie { get; private set; }
    public DateTime DateDelivranceUtc { get; private set; }
    public string DelivrePar { get; private set; } = null!;

    private DelivranceCertificat() { } // EF Core

    public static DelivranceCertificat Creer(Guid naissanceId, int numeroCopie, string delivrePar, DateTime maintenantUtc)
    {
        if (numeroCopie < 1)
            throw new DomainException("Le numéro de copie doit être positif.");
        if (string.IsNullOrWhiteSpace(delivrePar))
            throw new DomainException("L'agent qui délivre le certificat est obligatoire.");

        return new DelivranceCertificat
        {
            Id = Guid.CreateVersion7(),
            NaissanceId = naissanceId,
            NumeroCopie = numeroCopie,
            DateDelivranceUtc = maintenantUtc,
            DelivrePar = delivrePar.Trim()
        };
    }
}
