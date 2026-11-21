using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IdeaDiscovery.Api.Migrations
{
    /// <inheritdoc />
    public partial class MessageSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId_CreatedAt",
                table: "Messages");

            migrationBuilder.AddColumn<int>(
                name: "Sequence",
                table: "Messages",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            // Number any existing messages 1, 2, 3 ... in creation order before the unique index.
            migrationBuilder.Sql(@"UPDATE ""Messages"" SET ""Sequence"" = (
                SELECT COUNT(*) FROM ""Messages"" m2 WHERE m2.""ConversationId"" = ""Messages"".""ConversationId""
                AND (m2.""CreatedAt"" < ""Messages"".""CreatedAt""
                     OR (m2.""CreatedAt"" = ""Messages"".""CreatedAt"" AND m2.""Id"" <= ""Messages"".""Id"")))");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId_Sequence",
                table: "Messages",
                columns: new[] { "ConversationId", "Sequence" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Messages_ConversationId_Sequence",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "Sequence",
                table: "Messages");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ConversationId_CreatedAt",
                table: "Messages",
                columns: new[] { "ConversationId", "CreatedAt" });
        }
    }
}
