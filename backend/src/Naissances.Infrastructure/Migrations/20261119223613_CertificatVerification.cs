using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Naissances.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CertificatVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CodeVerification",
                schema: "etatcivil",
                table: "Naissances",
                type: "char(8)",
                unicode: false,
                fixedLength: true,
                maxLength: 8,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Commune",
                schema: "etatcivil",
                table: "Naissances",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "DelivrancesCertificat",
                schema: "etatcivil",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NaissanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NumeroCopie = table.Column<int>(type: "int", nullable: false),
                    DateDelivranceUtc = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    DelivrePar = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DelivrancesCertificat", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DelivrancesCertificat_Naissances_NaissanceId",
                        column: x => x.NaissanceId,
                        principalSchema: "etatcivil",
                        principalTable: "Naissances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Actes existants (avant cette version) : la commune reprend la ville, et chacun reçoit
            // un code de vérification aléatoire (NEWID() est réévalué pour chaque ligne et chaque caractère).
            // AVANT la création de l'index unique, sinon tous les codes vides entreraient en conflit.
            // Copie figée de CodeVerification.Alphabet : une migration ne doit pas changer après coup.
            const string alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
            var caractere = $"SUBSTRING('{alphabet}', ABS(CAST(CHECKSUM(NEWID()) AS bigint)) % 32 + 1, 1)";
            migrationBuilder.Sql($"""
                UPDATE etatcivil.Naissances SET Commune = Ville WHERE Commune = N'';
                UPDATE etatcivil.Naissances
                   SET CodeVerification = {string.Join(" + ", Enumerable.Repeat(caractere, 8))}
                 WHERE CodeVerification = '';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Naissances_CodeVerification",
                schema: "etatcivil",
                table: "Naissances",
                column: "CodeVerification",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DelivrancesCertificat_NaissanceId_NumeroCopie",
                schema: "etatcivil",
                table: "DelivrancesCertificat",
                columns: new[] { "NaissanceId", "NumeroCopie" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DelivrancesCertificat",
                schema: "etatcivil");

            migrationBuilder.DropIndex(
                name: "IX_Naissances_CodeVerification",
                schema: "etatcivil",
                table: "Naissances");

            migrationBuilder.DropColumn(
                name: "CodeVerification",
                schema: "etatcivil",
                table: "Naissances");

            migrationBuilder.DropColumn(
                name: "Commune",
                schema: "etatcivil",
                table: "Naissances");
        }
    }
}
