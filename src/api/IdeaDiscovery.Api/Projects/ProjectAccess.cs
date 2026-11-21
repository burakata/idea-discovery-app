using System.Security.Claims;
using IdeaDiscovery.Api.Auth;
using IdeaDiscovery.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IdeaDiscovery.Api.Projects;

// The one place that decides who may see a project. Every project query goes
// through it, and every later query filters by the id it approved
// (docs/engineering.md §11). Owners' access comes only from a ProjectMember
// row; Burak's only from the per-request consultant claim, which is read from
// User.IsConsultant, never from a membership row.
public static class ProjectAccess
{
    // The project when the caller may see it, otherwise null. An unknown id and
    // a project the caller is not in give the same null, so ids reveal nothing.
    public static async Task<Project?> FindAsync(AppDbContext db, ClaimsPrincipal caller, Guid projectId)
    {
        return await Visible(db, caller).Where(p => p.Id == projectId).SingleOrDefaultAsync();
    }

    // Burak's powers come only from the per-request claim, never from a membership row.
    public static bool IsConsultant(ClaimsPrincipal caller) =>
        caller.HasClaim(SessionValidation.ConsultantClaim, "true");

    // The projects the caller may see: all for Burak, otherwise the ones they belong to.
    public static IQueryable<Project> Visible(AppDbContext db, ClaimsPrincipal caller)
    {
        var userId = SessionValidation.UserId(caller);
        if (userId is null) return db.Projects.Where(_ => false);
        if (IsConsultant(caller)) return db.Projects;
        return from p in db.Projects
               join m in db.ProjectMembers on p.Id equals m.ProjectId
               where m.UserId == userId
               select p;
    }
}
