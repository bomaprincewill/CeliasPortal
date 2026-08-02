// actions/notifications/index.ts
"use server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getMyNotifications(limit = 20) {
  const session = await requireSession();
  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllRead() {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function sendNotification(input: {
  userIds: string[]; title: string; body: string; type?: string; link?: string;
}) {
  // Only admin/system can send
  const session = await requireSession(["SUPER_ADMIN"]);
  await prisma.notification.createMany({
    data: input.userIds.map(uid => ({
      userId: uid, title: input.title, body: input.body,
      type: input.type ?? "INFO", link: input.link,
    })),
  });
}
