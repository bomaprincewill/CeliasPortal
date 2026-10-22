// lib/auth.ts
// ============================================================
// NextAuth.js Configuration
// Extends JWT with role + ownership data for middleware use.
// ============================================================

import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Role } from "@/types";
import { credentialTag, credentialsMatch } from "@/lib/sessionCredentials";

const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MINUTES = 15;
const DUMMY_PASSWORD_HASH = "$2a$12$.NnveJ9pnG7ugRhTtW2G8.lfc5nAQ5Ebl6er0TNTzxQOboCKNvwv6";

async function recordLoginFailure(identifier: string, currentFailures: number) {
  const failures = currentFailures + 1;
  const lockedUntil = failures >= MAX_LOGIN_FAILURES
    ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000)
    : null;
  await prisma.authThrottle.upsert({
    where: { identifier },
    update: { failures, lockedUntil, lastAttemptAt: new Date() },
    create: { identifier, failures, lockedUntil, lastAttemptAt: new Date() },
  });
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      formClassId?: string;
      assignedSubjectIds?: string[];
      assignedClassIds?: string[];
      assignedSubjectClassPairs?: string[];
      childIds?: string[];
    };
  }
  interface User {
    id: string;
    role: Role;
    credentialTag?: string;
    formClassId?: string;
    assignedSubjectIds?: string[];
    assignedClassIds?: string[];
    assignedSubjectClassPairs?: string[];
    childIds?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    credentialTag?: string;
    formClassId?: string;
    assignedSubjectIds?: string[];
    assignedClassIds?: string[];
    assignedSubjectClassPairs?: string[];
    childIds?: string[];
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as never,

  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8h session

  pages: {
    signIn:  "/auth/signin",
    signOut: "/auth/signout",
    error:   "/auth/error",
  },

  providers: [
    CredentialsProvider({
      name: "School Portal",
      credentials: {
        email:    { label: "Email or student login", type: "text" },
        password: { label: "Password", type: "password" },
        demoAccount: { label: "Demo account", type: "text" },
      },
      async authorize(credentials) {
        const demoAccounts = new Set(["admin@school.edu", "finance@school.edu", "adaeze@school.edu", "ngozi@school.edu", "parent@school.edu", "applicant@school.edu"]);
        const demoEnabled = process.env.NODE_ENV === "development" && process.env.ENABLE_DEMO_QUICK_LOGIN !== "false";
        const requestedDemo = credentials?.demoAccount?.trim().toLowerCase();
        const isDemo = Boolean(demoEnabled && requestedDemo && demoAccounts.has(requestedDemo));
        const identifier = isDemo ? requestedDemo! : credentials?.email?.trim().toLowerCase();
        const submittedPassword = credentials?.password;
        if (!identifier || (!isDemo && !submittedPassword)) return null;
        const throttle = await prisma.authThrottle.findUnique({ where: { identifier } });
        if (throttle?.lockedUntil && throttle.lockedUntil > new Date()) return null;

        const user = await prisma.user.findUnique({
          where: { email: identifier },
          include: {
            teacher: {
              include: {
                formTeacherOfClass: { select: { id: true } },
                assignments: {
                  select: { subjectId: true, classId: true },
                },
              },
            },
            parent: {
              include: {
                children: { select: { studentId: true } },
              },
            },
          },
        });

        const isValid = isDemo || await bcrypt.compare(submittedPassword!, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user || !user.passwordHash || !user.isActive || !isValid) {
          await recordLoginFailure(identifier, throttle?.failures ?? 0);
          return null;
        }
        if (throttle) await prisma.authThrottle.delete({ where: { identifier } });

        // Build role-specific token extensions
        let formClassId: string | undefined;
        let assignedSubjectIds: string[] | undefined;
        let assignedClassIds:   string[] | undefined;
        let assignedSubjectClassPairs: string[] | undefined;
        let childIds:           string[] | undefined;

        if (user.teacher) {
          formClassId = user.teacher.formTeacherOfClass?.id;
          assignedSubjectIds = [...new Set(user.teacher.assignments.map((a) => a.subjectId))] as string[];
          assignedClassIds   = [...new Set(user.teacher.assignments.map((a) => a.classId))] as string[];
          assignedSubjectClassPairs = user.teacher.assignments.map((a) => `${a.classId}:${a.subjectId}`);
        }

        if (user.parent) {
          childIds = user.parent.children.map((c) => c.studentId);
        }

        // Record last login (fire-and-forget)
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {});

        return {
          id:    user.id,
          name:  user.name,
          email: user.email,
          role:  user.role,
          credentialTag: credentialTag(user.passwordHash),
          formClassId,
          assignedSubjectIds,
          assignedClassIds,
          assignedSubjectClassPairs,
          childIds,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in: merge user data into token
      if (user) {
        token.credentialTag      = user.credentialTag;
        token.role               = user.role;
        token.formClassId        = user.formClassId;
        token.assignedSubjectIds = user.assignedSubjectIds;
        token.assignedClassIds   = user.assignedClassIds;
        token.assignedSubjectClassPairs = user.assignedSubjectClassPairs;
        token.childIds           = user.childIds;
      }

      // On session update (e.g. teacher reassigned)
      if (trigger === "update" && token.sub) {
        const current = await loadSessionUser(token.sub);
        if (!current?.isActive || !credentialsMatch(token.credentialTag, current.passwordHash)) return {} as typeof token;
        Object.assign(token, sessionClaims(current));
      }

      return token;
    },

    async session({ session, token }) {
      const current = token.sub ? await loadSessionUser(token.sub) : null;
      if (!current?.isActive || !credentialsMatch(token.credentialTag, current.passwordHash)) return null as never;
      const claims = sessionClaims(current);
      session.user.id                 = token.sub!;
      Object.assign(session.user, claims, { name: current.name, email: current.email });
      return session;
    },
  },

  events: {
    async signIn({ user }) {
      await prisma.auditLog.create({
        data: {
          userId:      user.id,
          action:      "LOGIN",
          entity:      "User",
          entityId:    user.id,
          description: `User ${user.email} signed in`,
        },
      }).catch(() => {});
    },
    async signOut({ token }) {
      if (token?.sub) {
        await prisma.auditLog.create({
          data: {
            userId:      token.sub,
            action:      "LOGOUT",
            entity:      "User",
            entityId:    token.sub,
            description: `User signed out`,
          },
        }).catch(() => {});
      }
    },
  },
};

// ─── Server-side helpers ──────────────────────────────────────

export const getSession = () => getServerSession(authOptions);

async function loadSessionUser(id: string) {
  return prisma.user.findUnique({ where: { id }, select: {
    id: true, name: true, email: true, role: true, isActive: true, passwordHash: true,
    teacher: { select: { formClassId: true, assignments: { select: { classId: true, subjectId: true } } } },
    parent: { select: { children: { select: { studentId: true } } } },
  } });
}

function sessionClaims(user: NonNullable<Awaited<ReturnType<typeof loadSessionUser>>>) {
  const assignments = user.teacher?.assignments ?? [];
  return {
    role: user.role,
    formClassId: user.teacher?.formClassId ?? undefined,
    assignedSubjectIds: [...new Set(assignments.map(item => item.subjectId))],
    assignedClassIds: [...new Set(assignments.map(item => item.classId))],
    assignedSubjectClassPairs: assignments.map(item => `${item.classId}:${item.subjectId}`),
    childIds: user.parent?.children.map(item => item.studentId) ?? [],
  };
}

/** Throws if not authenticated or role check fails */
export async function requireSession(allowedRoles?: Role[]) {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
