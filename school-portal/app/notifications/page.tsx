import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Providers from "@/components/layout/Providers";
import DashboardShell from "@/components/layout/DashboardShell";

const TYPE_COLOR: Record<string, string> = {
  INFO: "bg-blue-50 border-blue-200 text-blue-700",
  SUCCESS: "bg-emerald-50 border-emerald-200 text-emerald-700",
  WARNING: "bg-yellow-50 border-yellow-200 text-yellow-700",
  ALERT: "bg-red-50 border-red-200 text-red-700",
};

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/signin");

  const notifications = await prisma.notification.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Providers>
      <DashboardShell>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="page-header mb-0">
              <h1 className="page-title flex items-center gap-2">
                <Bell className="w-6 h-6 text-brand-600"/>
                Notifications
                {unreadCount > 0 && <span className="badge-red">{unreadCount}</span>}
              </h1>
              <p className="page-subtitle">{notifications.length} total</p>
            </div>
            {unreadCount > 0 && (
              <form action={async () => {
                "use server";
                await prisma.notification.updateMany({
                  where: { userId: session.user.id, isRead: false },
                  data: { isRead: true, readAt: new Date() },
                });
              }}>
                <button type="submit" className="btn-ghost btn-sm gap-2">
                  <CheckCheck className="w-4 h-4"/> Mark all read
                </button>
              </form>
            )}
          </div>

          {notifications.length === 0 && (
            <div className="card card-body text-center py-16">
              <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3"/>
              <p className="text-muted">No notifications yet.</p>
            </div>
          )}

          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id}
                className={`card card-body border-l-4 ${n.isRead ? "opacity-70" : "shadow-sm"} ${TYPE_COLOR[n.type] ?? "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${n.isRead ? "text-muted" : "text-ink"}`}>{n.title}</p>
                    <p className="text-xs text-muted mt-0.5">{n.body}</p>
                    {n.link && (
                      <a href={n.link} className="text-xs text-brand-600 hover:underline mt-1 block">{n.link}</a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-500"/>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DashboardShell>
    </Providers>
  );
}
