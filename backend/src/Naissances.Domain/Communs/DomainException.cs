namespace Naissances.Domain.Communs;

/// <summary>
/// Violation d'une règle métier. Traduite en HTTP 422 (ProblemDetails) par l'API.
/// Le champ <see cref="Champ"/> permet au frontend React d'afficher l'erreur
/// directement sous le bon input (setError de React Hook Form).
/// </summary>
public sealed class DomainException(string message, string? champ = null) : Exception(message)
{
    public string? Champ { get; } = champ;
}
