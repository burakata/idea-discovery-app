using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdeaDiscovery.Api.Migrations
{
    /// <inheritdoc />
    public partial class InvitationLanguage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "Invitations",
                type: "TEXT",
                nullable: false,
                defaultValue: "en");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Language",
                table: "Invitations");
        }
    }
}
