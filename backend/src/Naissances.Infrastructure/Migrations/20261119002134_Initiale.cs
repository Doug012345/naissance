using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Naissances.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initiale : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "etatcivil");

            migrationBuilder.CreateSequence(
                name: "NumeroActeSequence",
                schema: "etatcivil");

            migrationBuilder.CreateTable(
                name: "Naissances",
                schema: "etatcivil",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NumeroActe = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Enfant_Prenom = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Enfant_Nom = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Sexe = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DateHeureNaissance = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    Etablissement = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Ville = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PoidsGrammes = table.Column<int>(type: "int", nullable: false),
                    TailleCm = table.Column<decimal>(type: "decimal(4,1)", precision: 4, scale: 1, nullable: false),
                    Mere_Prenom = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Mere_Nom = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Mere_DateNaissance = table.Column<DateOnly>(type: "date", nullable: false),
                    SecondParent_Prenom = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SecondParent_Nom = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SecondParent_DateNaissance = table.Column<DateOnly>(type: "date", nullable: true),
                    Statut = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MotifAnnulation = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DateEnregistrementUtc = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Naissances", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Naissances_DateHeureNaissance",
                schema: "etatcivil",
                table: "Naissances",
                column: "DateHeureNaissance");

            migrationBuilder.CreateIndex(
                name: "IX_Naissances_Enfant_Nom",
                schema: "etatcivil",
                table: "Naissances",
                column: "Enfant_Nom");

            migrationBuilder.CreateIndex(
                name: "IX_Naissances_NumeroActe",
                schema: "etatcivil",
                table: "Naissances",
                column: "NumeroActe",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Naissances",
                schema: "etatcivil");

            migrationBuilder.DropSequence(
                name: "NumeroActeSequence",
                schema: "etatcivil");
        }
    }
}
