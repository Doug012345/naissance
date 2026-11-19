using Naissances.Domain.Naissances;

namespace Naissances.Application.Naissances;

// ---------- Commandes (entrées) ----------
// Les noms de propriétés correspondent EXACTEMENT au schéma Zod du frontend
// (camelCase côté JSON). C'est le « contrat » entre React et l'API.

public sealed record ParentCommande(string Prenom, string Nom, DateOnly DateNaissance);

public sealed record EnregistrerNaissanceCommande(
    string Prenom,
    string Nom,
    Sexe Sexe,
    DateTime DateHeureNaissance,
    string Etablissement,
    string Ville,
    string Commune,
    int PoidsGrammes,
    decimal TailleCm,
    ParentCommande Mere,
    ParentCommande? SecondParent);

/// <param name="Version">rowversion encodée en base64, reçue lors du GET détail.</param>
public sealed record AnnulerNaissanceCommande(string Motif, string Version);

// ---------- Requêtes ----------

public sealed record RechercheNaissances(
    string? Recherche,
    StatutNaissance? Statut,
    int Page = 1,
    int Taille = 10)
{
    public int PageNormalisee => Page < 1 ? 1 : Page;
    public int TailleNormalisee => Taille is < 1 or > 50 ? 10 : Taille;
}

// ---------- DTO (sorties) ----------

public sealed record PageResultat<T>(IReadOnlyList<T> Elements, int Page, int Taille, int Total)
{
    public int TotalPages => (int)Math.Ceiling(Total / (double)Taille);
}

public sealed record NaissanceResumeDto(
    Guid Id,
    string NumeroActe,
    string NomCompletEnfant,
    Sexe Sexe,
    DateTime DateHeureNaissance,
    string Ville,
    StatutNaissance Statut);

public sealed record ParentDto(string Prenom, string Nom, DateOnly DateNaissance);

public sealed record NaissanceDetailDto(
    Guid Id,
    string NumeroActe,
    string Prenom,
    string Nom,
    Sexe Sexe,
    DateTime DateHeureNaissance,
    string Etablissement,
    string Ville,
    string Commune,
    string CodeVerification,
    int PoidsGrammes,
    decimal TailleCm,
    ParentDto Mere,
    ParentDto? SecondParent,
    StatutNaissance Statut,
    string? MotifAnnulation,
    DateTime DateEnregistrementUtc,
    string Version);

/// <summary>Une impression du certificat (copie numérotée).</summary>
public sealed record DelivranceDto(int NumeroCopie, DateTime DateDelivranceUtc, string DelivrePar);

/// <summary>
/// Réponse PUBLIQUE de la page de vérification (sans connexion) : le strict minimum (Loi 25).
/// Les initiales seules : la personne qui vérifie compare avec le certificat papier qu'elle a en main.
/// </summary>
public sealed record VerificationDto(
    string NumeroActe,
    string InitialesEnfant,
    DateOnly DateNaissance,
    string Commune,
    StatutNaissance Statut,
    DateTime DateEnregistrementUtc);
