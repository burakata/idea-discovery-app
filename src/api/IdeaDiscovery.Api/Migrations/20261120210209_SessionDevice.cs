using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdeaDiscovery.Api.Migrations
{
    /// <inheritdoc />
    public partial class SessionDevice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Device",
                table: "UserSessions",
                type: "TEXT",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "UserSessions",
                type: "TEXT",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Device",
                table: "UserSessions");

            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "UserSessions");
        }
    }
}
