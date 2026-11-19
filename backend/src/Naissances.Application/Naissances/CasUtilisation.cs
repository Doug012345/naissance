using Naissances.Application.Abstractions;
using Naissances.Domain.Naissances;

namespace Naissances.Application.Naissances;

/// <summary>Cas d'utilisation : enregistrer une nouvelle naissance.</summary>
public sealed class EnregistrerNaissance(
    INaissanceRepository repository,
    IGenerateurNumeroActe generateur,
    TimeProvider horloge)
{
    public async Task<Guid> ExecuterAsync(EnregistrerNaissanceCommande cmd, CancellationToken ct)
    {
        var maintenant = horloge.GetUtcNow().UtcDateTime;
        var dateEnfant = DateOnly.FromDateTime(cmd.DateHeureNaissance);

        // Les objets valeur lèvent DomainException avec le nom du champ fautif.
        var enfant = Identite.Creer(cmd.Prenom, cmd.Nom, "enfant");
        var mere = Parent.Creer(Identite.Creer(cmd.Mere.Prenom, cmd.Mere.Nom, "mere"),
                                cmd.Mere.DateNaissance, dateEnfant, "mere");
        var second = cmd.SecondParent is null
            ? null
            : Parent.Creer(Identite.Creer(cmd.SecondParent.Prenom, cmd.SecondParent.Nom, "secondParent"),
                           cmd.SecondParent.DateNaissance, dateEnfant, "secondParent");

        var numero = await generateur.ProchainAsync(maintenant.Year, ct);

        var naissance = Naissance.Enregistrer(
            numero, enfant, cmd.Sexe, cmd.DateHeureNaissance, cmd.Etablissement, cmd.Ville, cmd.Commune,
            cmd.PoidsGrammes, cmd.TailleCm, mere, second, maintenant);

        repository.Ajouter(naissance);
        await repository.SauvegarderAsync(ct);
        return naissance.Id;
    }
}

/// <summary>Cas d'utilisation : annuler une déclaration (erreur de saisie, doublon…).</summary>
public sealed class AnnulerNaissance(INaissanceRepository repository)
{
    public async Task ExecuterAsync(Guid id, AnnulerNaissanceCommande cmd, CancellationToken ct)
    {
        var naissance = await repository.ObtenirAsync(id, ct)
                        ?? throw new IntrouvableException($"Naissance {id} introuvable.");

        repository.DefinirVersionAttendue(naissance, Convert.FromBase64String(cmd.Version));
        naissance.Annuler(cmd.Motif);
        await repository.SauvegarderAsync(ct);
    }
}

/// <summary>
/// Cas d'utilisation : délivrer (imprimer) une copie du certificat de naissance.
/// Chaque impression est journalisée avec un numéro de copie croissant.
/// Un acte annulé reste imprimable : le certificat porte alors le filigrane « ANNULÉ ».
/// </summary>
public sealed class DelivrerCertificat(INaissanceRepository repository, TimeProvider horloge)
{
    public async Task<DelivranceDto> ExecuterAsync(Guid naissanceId, string delivrePar, CancellationToken ct)
    {
        _ = await repository.ObtenirAsync(naissanceId, ct)
            ?? throw new IntrouvableException($"Naissance {naissanceId} introuvable.");

        var maintenant = horloge.GetUtcNow().UtcDateTime;
        var copie = await repository.CompterDelivrancesAsync(naissanceId, ct) + 1;
        var delivrance = DelivranceCertificat.Creer(naissanceId, copie, delivrePar, maintenant);

        repository.AjouterDelivrance(delivrance);
        await repository.SauvegarderAsync(ct);
        return new DelivranceDto(delivrance.NumeroCopie, delivrance.DateDelivranceUtc, delivrance.DelivrePar);
    }
}
