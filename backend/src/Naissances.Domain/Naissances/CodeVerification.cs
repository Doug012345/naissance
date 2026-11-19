using System.Security.Cryptography;
using System.Text;

namespace Naissances.Domain.Naissances;

/// <summary>
/// Code imprimé sur le certificat (et dans le QR code) pour vérifier son authenticité en ligne.
/// 8 caractères tirés au hasard (générateur cryptographique) dans l'alphabet de Crockford :
/// 32^8 ≈ 1 100 milliards de combinaisons → impossible à deviner, surtout avec la limite de requêtes.
/// Pas de I, L, O, U : pas de confusion à la lecture (O/0, I/1…).
/// Stocké sans tiret (« K7QF9M2X »), affiché « K7QF-9M2X ».
/// </summary>
public static class CodeVerification
{
    public const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    public const int Longueur = 8;

    public static string Generer() => RandomNumberGenerator.GetString(Alphabet, Longueur);

    /// <summary>
    /// Saisie tolérante : minuscules, tirets, espaces, et lettres ambiguës (O→0, I/L→1).
    /// Retourne null si le code ne peut pas être valide.
    /// </summary>
    public static string? Normaliser(string? saisie)
    {
        if (string.IsNullOrWhiteSpace(saisie)) return null;

        var sb = new StringBuilder(Longueur);
        foreach (var c in saisie.ToUpperInvariant())
        {
            var car = c switch { 'O' => '0', 'I' or 'L' => '1', _ => c };
            if (char.IsWhiteSpace(car) || car == '-') continue;
            if (!Alphabet.Contains(car)) return null;
            sb.Append(car);
        }
        return sb.Length == Longueur ? sb.ToString() : null;
    }

    public static string Formater(string code) =>
        code.Length == Longueur ? $"{code[..4]}-{code[4..]}" : code;
}
