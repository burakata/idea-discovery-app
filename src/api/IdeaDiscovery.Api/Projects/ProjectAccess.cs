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
        var userId = SessionValidation.UserId(caller);
        if (userId is null) return null;

        if (caller.HasClaim(SessionValidation.ConsultantClaim, "true"))
            return await db.Projects.SingleOrDefaultAsync(p => p.Id == projectId);

        return await (from p in db.Projects
                      join m in db.ProjectMembers on p.Id equals m.ProjectId
                      where p.Id == projectId && m.UserId == userId
                      select p).SingleOrDefaultAsync();
    }
}
