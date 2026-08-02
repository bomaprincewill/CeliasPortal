import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Shield, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ACTION_BADGE: Record<string, string> = {
  LOGIN:"badge-gray", LOGOUT:"badge-gray", CREATE:"badge-green", UPDATE:"badge-blue",
  DELETE:"badge-red", SUBMIT:"badge-yellow", APPROVE:"badge-blue", LOCK:"badge-purple",
  UNLOCK:"badge-orange", UPLOAD:"badge-cyan",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  const query = await searchParams;
  const session = await getSession();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/auth/signin");

  const page   = parseInt(query.page ?? "1");
  const limit  = 50;
  const entity = query.entity ?? "";

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: entity ? { entity } : {},
      include: { user: { select: { name:true, email:true, role:true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.auditLog.count({ where: entity ? { entity } : {} }),
  ]);

  const entities = await prisma.auditLog.groupBy({ by:["entity"], _count:true });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Shield className="w-6 h-6 text-brand-600"/>Audit Log</h1>
        <p className="page-subtitle">{total} total events recorded</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href="/admin/audit" className={`btn-sm ${!entity?"btn-primary":"btn-secondary"}`}>All</a>
        {entities.map(e=>(
          <a key={e.entity} href={`/admin/audit?entity=${e.entity}`}
            className={`btn-sm ${entity===e.entity?"btn-primary":"btn-secondary"}`}>
            {e.entity} <span className="opacity-60">({e._count})</span>
          </a>
        ))}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th><th>Entity</th><th>Description</th><th>User</th><th>IP</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td><span className={ACTION_BADGE[log.action]??"badge-gray"}>{log.action}</span></td>
                <td className="text-muted text-xs font-mono">{log.entity}{log.entityId ? `:${log.entityId.slice(0,8)}` : ""}</td>
                <td className="max-w-xs"><p className="text-xs text-ink line-clamp-2">{log.description}</p></td>
                <td>
                  {log.user ? (
                    <div>
                      <div className="text-xs font-medium text-ink">{log.user.name}</div>
                      <div className="text-xs text-muted">{log.user.role}</div>
                    </div>
                  ) : <span className="text-xs text-muted">System</span>}
                </td>
                <td className="text-xs font-mono text-muted">{log.ipAddress ?? "—"}</td>
                <td className="text-xs text-muted whitespace-nowrap">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix:true })}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-muted">No audit records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Page {page} of {Math.ceil(total/limit)}</span>
          <div className="flex gap-2">
            {page > 1 && <a href={`/admin/audit?page=${page-1}&entity=${entity}`} className="btn-secondary btn-sm">Previous</a>}
            {page * limit < total && <a href={`/admin/audit?page=${page+1}&entity=${entity}`} className="btn-secondary btn-sm">Next</a>}
          </div>
        </div>
      )}
    </div>
  );
}
