using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Data;

public static class DatabaseSetup
{
    public static void AddDatabase(this IServiceCollection services, IConfiguration config)
    {
        var connection = config.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connection))
            throw new InvalidOperationException(
                "ConnectionStrings:Default is not set. Set it in configuration or an environment variable.");
        services.AddDbContext<AppDbContext>(o => o.UseSqlite(connection));
    }

    // Applies migrations, then makes the configured consultant the only one.
    public static void Initialise(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
        SyncConsultant(
            db,
            scope.ServiceProvider.GetRequiredService<IConfiguration>(),
            scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Consultant"));
    }

    public static void SyncConsultant(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var configured = config["Consultant:Email"];
        if (string.IsNullOrWhiteSpace(configured))
        {
            logger.LogWarning("Consultant:Email is not set, so nobody is the consultant.");
            foreach (var other in db.Users.Where(u => u.IsConsultant))
                other.IsConsultant = false;
            db.SaveChanges();
            return;
        }

        var email = Emails.Normalise(configured);
        var user = db.Users.SingleOrDefault(u => u.Email == email);
        if (user is null)
        {
            var name = config["Consultant:DisplayName"];
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                DisplayName = string.IsNullOrWhiteSpace(name) ? "Burak" : name.Trim(),
                CreatedAt = DateTime.UtcNow,
            };
            db.Users.Add(user);
        }
        user.IsConsultant = true;

        foreach (var other in db.Users.Where(u => u.IsConsultant && u.Email != email))
            other.IsConsultant = false;
        db.SaveChanges();
    }
}
