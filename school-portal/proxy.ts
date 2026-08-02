// middleware.ts
// ============================================================
// Next.js RBAC Middleware
// Intercepts every request and enforces role-based routing.
// JWT is decoded from the NextAuth session cookie.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ─── Route Configuration ──────────────────────────────────────

/**
 * Strict route map: each entry defines which roles can access
 * a given path prefix, and any additional runtime checks.
 *
 * Order matters — first match wins.
 */
const ROUTE_RULES: RouteRule[] = [
  // ── Public routes (always allow) ──────────────────────────
  { pattern: /^\/$/, roles: "*" },
  { pattern: /^\/auth/, roles: "*" },
  { pattern: /^\/api\/auth/, roles: "*" },
  { pattern: /^\/api\/health/, roles: "*" },
  { pattern: /^\/apply/, roles: "*" },          // applicant registration

  // ── Applicant portal ──────────────────────────────────────
  { pattern: /^\/applicant/, roles: ["APPLICANT"] },
  { pattern: /^\/api\/applicant/, roles: ["APPLICANT"] },

  // Student portal
  { pattern: /^\/student/, roles: ["STUDENT"] },

  // ── Parent portal ─────────────────────────────────────────
  { pattern: /^\/parent/, roles: ["PARENT"] },
  { pattern: /^\/api\/parent/, roles: ["PARENT"] },

  { pattern: /^\/finance/, roles: ["SUPER_ADMIN", "BURSAR_ACCOUNTANT", "SECRETARY"] },
  { pattern: /^\/api\/finance/, roles: ["SUPER_ADMIN", "BURSAR_ACCOUNTANT", "SECRETARY"] },

  // ── Subject teacher routes ────────────────────────────────
  {
    pattern: /^\/teacher\/results/,
    roles: ["SUBJECT_TEACHER", "FORM_TEACHER", "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"],
    // Dynamic check: subject teacher can only access their assigned subjects
    dynamicCheck: "subjectTeacherOwnership",
  },
  {
    pattern: /^\/teacher\/attendance/,
    roles: ["FORM_TEACHER", "SUPER_ADMIN"],
    dynamicCheck: "formTeacherOwnership",
  },
  {
    pattern: /^\/teacher\/broadsheet/,
    roles: ["FORM_TEACHER", "SUPER_ADMIN"],
    dynamicCheck: "formTeacherOwnership",
  },
  { pattern: /^\/teacher/, roles: ["SUBJECT_TEACHER", "FORM_TEACHER", "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"] },
  { pattern: /^\/api\/teacher/, roles: ["SUBJECT_TEACHER", "FORM_TEACHER", "SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"] },

  // ── Admin routes ──────────────────────────────────────────
  { pattern: /^\/admin\/users/, roles: ["SUPER_ADMIN", "ADMIN"] },
  { pattern: /^\/admin\/(audit|settings)/, roles: ["SUPER_ADMIN"] },
  { pattern: /^\/admin\/applicants/, roles: ["SUPER_ADMIN", "ADMIN"] },
  { pattern: /^\/admin\/exams/, roles: ["SUPER_ADMIN", "ADMIN", "PRIMARY_HEAD", "PRINCIPAL"] },
  { pattern: /^\/admin\/subjects/, roles: ["SUPER_ADMIN", "ADMIN"] },
  { pattern: /^\/admin/, roles: ["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"] },
  { pattern: /^\/api\/admin/, roles: ["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"] },

  // ── Shared authenticated routes ───────────────────────────
  { pattern: /^\/dashboard/, roles: ["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL", "FORM_TEACHER", "SUBJECT_TEACHER", "PARENT"] },
  { pattern: /^\/api\/notifications/, roles: ["SUPER_ADMIN", "ADMIN", "BURSAR_ACCOUNTANT", "SECRETARY", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL", "FORM_TEACHER", "SUBJECT_TEACHER", "PARENT", "APPLICANT"] },
  { pattern: /^\/api\/profile/, roles: ["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL", "FORM_TEACHER", "SUBJECT_TEACHER", "PARENT", "APPLICANT"] },

  // ── CBT API ───────────────────────────────────────────────
  { pattern: /^\/api\/cbt\/entrance/, roles: ["APPLICANT"] },
  { pattern: /^\/api\/cbt/, roles: ["SUPER_ADMIN", "FORM_TEACHER", "SUBJECT_TEACHER", "STUDENT", "APPLICANT"] },

  // ── Fallthrough: block everything else unless authenticated ─
  { pattern: /.*/, roles: "AUTHENTICATED" },
];

type AllowedRoles = string[] | "*" | "AUTHENTICATED";

interface RouteRule {
  pattern: RegExp;
  roles: AllowedRoles;
  dynamicCheck?: DynamicCheckKey;
}

type DynamicCheckKey = "subjectTeacherOwnership" | "formTeacherOwnership";

// ─── JWT Token Shape ──────────────────────────────────────────

interface ExtendedToken {
  sub: string;
  role: string;
  email: string;
  name: string;
  // populated from DB on sign-in
  formClassId?: string;          // for form teachers
  assignedSubjectIds?: string[]; // for subject teachers
  assignedClassIds?: string[];   // for subject teachers
  assignedSubjectClassPairs?: string[];
  childIds?: string[];           // for parents
  iat: number;
  exp: number;
}

// ─── Role → Dashboard redirect map ───────────────────────────

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN:     "/admin/dashboard",
  ADMIN:           "/admin/dashboard",
  BURSAR_ACCOUNTANT: "/finance/dashboard",
  SECRETARY:       "/finance/dashboard",
  NURSERY_HEAD:    "/admin/dashboard",
  PRIMARY_HEAD:    "/admin/dashboard",
  PRINCIPAL:       "/admin/dashboard",
  FORM_TEACHER:    "/teacher/dashboard",
  SUBJECT_TEACHER: "/teacher/dashboard",
  PARENT:          "/parent/dashboard",
  APPLICANT:       "/applicant/dashboard",
  STUDENT:         "/student/dashboard",
};

// ─── Middleware ───────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Decode JWT from cookie (works with NextAuth's default cookie)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET!,
  }) as unknown as ExtendedToken | null;

  // Find first matching rule
  const rule = ROUTE_RULES.find((r) => r.pattern.test(pathname));

  if (!rule) {
    // No rule matched — allow (should not happen given catch-all)
    return NextResponse.next();
  }

  // ── Public route ────────────────────────────────────────────
  if (rule.roles === "*") {
    // If user is already logged in and hitting /auth/signin, redirect to dashboard
    if (pathname.startsWith("/auth/signin") && token) {
      const home = ROLE_HOME[token.role] ?? "/dashboard";
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  // ── Must be authenticated ────────────────────────────────────
  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // ── Any authenticated user ──────────────────────────────────
  if (rule.roles === "AUTHENTICATED") {
    return NextResponse.next();
  }

  // ── Role check ───────────────────────────────────────────────
  const userRole = token.role;
  if (!rule.roles.includes(userRole)) {
    return buildForbiddenResponse(request, token, pathname);
  }

  // ── Dynamic ownership checks ─────────────────────────────────
  if (rule.dynamicCheck) {
    const ownershipResult = await runDynamicCheck(
      rule.dynamicCheck,
      pathname,
      token,
      request
    );
    if (!ownershipResult.allowed) {
      return buildForbiddenResponse(request, token, pathname, ownershipResult.reason);
    }
  }

  // ── Rate limiting headers (basic) ────────────────────────────
  const response = NextResponse.next();
  response.headers.set("X-User-Role", userRole);
  response.headers.set("X-User-Id", token.sub);
  return response;
}

// ─── Dynamic Ownership Checks ─────────────────────────────────

async function runDynamicCheck(
  check: DynamicCheckKey,
  pathname: string,
  token: ExtendedToken,
  _request: NextRequest
): Promise<{ allowed: boolean; reason?: string }> {

  if (["SUPER_ADMIN", "ADMIN", "NURSERY_HEAD", "PRIMARY_HEAD", "PRINCIPAL"].includes(token.role)) {
    // Administrative leadership roles bypass teacher ownership checks.
    return { allowed: true };
  }

  switch (check) {
    case "subjectTeacherOwnership": {
      /**
       * URL pattern: /teacher/results/[classId]/[subjectId]
       * Verify that the subject teacher is actually assigned
       * to this class+subject combination.
       */
      const segments = pathname.split("/").filter(Boolean);
      // e.g. ["teacher","results","cls_abc123","sub_xyz789"]
      const classId   = segments[2];
      const subjectId = segments[3];

      if (!classId || !subjectId) {
        // No specific resource — allow (they'll see filtered list)
        return { allowed: true };
      }

      if (token.role === "FORM_TEACHER") {
        return token.formClassId === classId
          ? { allowed: true }
          : { allowed: false, reason: "You can only access results for your form class." };
      }

      const isAssigned = token.assignedSubjectClassPairs?.includes(`${classId}:${subjectId}`);

      if (!isAssigned) {
        return {
          allowed: false,
          reason: `You are not assigned to class ${classId} for subject ${subjectId}.`,
        };
      }

      return { allowed: true };
    }

    case "formTeacherOwnership": {
      /**
       * URL pattern: /teacher/attendance/[classId] or /teacher/broadsheet/[classId]
       * Verify the form teacher owns this class.
       */
      const segments = pathname.split("/").filter(Boolean);
      const classId  = segments[2];

      if (!classId) return { allowed: true };

      if (token.formClassId !== classId) {
        return {
          allowed: false,
          reason: `You are not the form teacher of class ${classId}.`,
        };
      }

      return { allowed: true };
    }

    default:
      return { allowed: true };
  }
}

// ─── Forbidden Response ───────────────────────────────────────

function buildForbiddenResponse(
  request: NextRequest,
  token: ExtendedToken,
  pathname: string,
  reason?: string
) {
  // API routes → JSON 403
  if (pathname.startsWith("/api/")) {
    return new NextResponse(
      JSON.stringify({
        error: "Forbidden",
        message: reason ?? "You do not have permission to access this resource.",
        role: token.role,
        path: pathname,
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Page routes → redirect to role home with error param
  const home = new URL(ROLE_HOME[token.role] ?? "/", request.url);
  home.searchParams.set("error", "forbidden");
  if (reason) home.searchParams.set("reason", reason);
  return NextResponse.redirect(home);
}

// ─── Matcher ──────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
