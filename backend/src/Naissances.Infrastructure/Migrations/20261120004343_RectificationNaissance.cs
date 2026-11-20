using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Naissances.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RectificationNaissance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DateDerniereRectificationUtc",
                schema: "etatcivil",
                table: "Naissances",
                type: "datetime2(0)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RectificationsNaissance",
                schema: "etatcivil",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    NaissanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DateRectificationUtc = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    RectifiePar = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Motif = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AncienCodeVerification = table.Column<string>(type: "char(8)", unicode: false, fixedLength: true, maxLength: 8, nullable: false),
                    Changements = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RectificationsNaissance", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RectificationsNaissance_Naissances_NaissanceId",
                        column: x => x.NaissanceId,
                        principalSchema: "etatcivil",
                        principalTable: "Naissances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RectificationsNaissance_AncienCodeVerification",
                schema: "etatcivil",
                table: "RectificationsNaissance",
                column: "AncienCodeVerification",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RectificationsNaissance_NaissanceId",
                schema: "etatcivil",
                table: "RectificationsNaissance",
                column: "NaissanceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RectificationsNaissance",
                schema: "etatcivil");

            migrationBuilder.DropColumn(
                name: "DateDerniereRectificationUtc",
                schema: "etatcivil",
                table: "Naissances");
        }
    }
}
