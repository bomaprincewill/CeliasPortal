"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BookOpen, LayoutDashboard, HelpCircle, ClipboardList,
  Users, Settings, LogOut, GraduationCap, BookMarked,
  BarChart2, School, Calendar, FileText, Bell, Shield,
  UserCheck, Home, ChevronDown, ChevronRight, X, AlertTriangle, LockKeyhole,
} from "lucide-react";
import { cn } from "@/components/ui";
import { useEffect, useState } from "react";

type NavItem = {
  label: string; href: string; icon: React.ElementType;
  children?: { label: string; href: string }[];
};

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "Dashboard",   href: "/admin/dashboard",  icon: LayoutDashboard },
    { label: "Users",       href: "/admin/users",       icon: Users },
    { label: "Classes",     href: "/admin/classes",     icon: School },
    { label: "Enrollments", href: "/admin/enrollments", icon: GraduationCap },
    { label: "Subjects",    href: "/admin/subjects",    icon: BookMarked },
    { label: "Results",     href: "/admin/results",     icon: BarChart2,
      children: [
        { label: "Score Entry",  href: "/admin/results" },
        { label: "Broad Sheets", href: "/admin/broadsheets" },
        { label: "Compile",      href: "/admin/compile" },
      ]
    },
    { label: "Exams / CBT", href: "/admin/exams",      icon: ClipboardList },
    { label: "Attendance",  href: "/admin/attendance",  icon: Calendar },
    { label: "Finance",     href: "/finance/dashboard",  icon: FileText,
      children: [
        { label: "Receipt Generator", href: "/finance/dashboard" },
        { label: "Paid Receipts", href: "/finance/paid-receipts" },
        { label: "Outstanding", href: "/finance/outstanding" },
      ]
    },
    { label: "Applicants",  href: "/admin/applicants",  icon: UserCheck },
    { label: "Audit Log",   href: "/admin/audit",       icon: Shield },
    { label: "Settings",    href: "/admin/settings",    icon: Settings },
  ],
  FORM_TEACHER: [
    { label: "Dashboard",   href: "/teacher/dashboard", icon: LayoutDashboard },
    { label: "My Class",    href: "/teacher/class",     icon: School },
    { label: "Attendance",  href: "/teacher/attendance",icon: Calendar },
    { label: "Results",     href: "/teacher/results",   icon: BarChart2 },
    { label: "Broad Sheet", href: "/teacher/broadsheet",icon: FileText },
    { label: "CBT Exams",   href: "/teacher/exams",     icon: ClipboardList },
  ],
  SUBJECT_TEACHER: [
    { label: "Dashboard",   href: "/teacher/dashboard", icon: LayoutDashboard },
    { label: "Score Entry", href: "/teacher/results",   icon: BarChart2 },
    { label: "CBT Exams",   href: "/teacher/exams",     icon: ClipboardList },
  ],
  PARENT: [
    { label: "Home",        href: "/parent/dashboard",  icon: Home },
    { label: "Report Card", href: "/parent/report",     icon: FileText },
    { label: "Attendance",  href: "/parent/attendance", icon: Calendar },
  ],
  APPLICANT: [
    { label: "Dashboard",   href: "/applicant/dashboard", icon: Home },
    { label: "Exam",        href: "/applicant/exam",      icon: HelpCircle },
    { label: "Status",      href: "/applicant/status",    icon: UserCheck },
  ],
  STUDENT: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "Academic History", href: "/student/history", icon: BarChart2 },
    { label: "Attendance", href: "/student/attendance", icon: Calendar },
    { label: "My CBT Exams", href: "/student/exams", icon: ClipboardList },
  ],
  BURSAR_ACCOUNTANT: [
    { label:"Receipt Generator", href:"/finance/dashboard", icon:FileText },
    { label:"Paid Receipts", href:"/finance/paid-receipts", icon:ClipboardList },
    { label:"Outstanding", href:"/finance/outstanding", icon:AlertTriangle },
  ],
  SECRETARY: [
    { label:"Receipt Generator", href:"/finance/dashboard", icon:FileText },
    { label:"Paid Receipts", href:"/finance/paid-receipts", icon:ClipboardList },
    { label:"Outstanding", href:"/finance/outstanding", icon:AlertTriangle },
  ],
};

const OPERATIONAL_ADMIN_NAV = NAV_BY_ROLE.SUPER_ADMIN.filter(
  (item) => !["Users", "Audit Log", "Settings", "Applicants"].includes(item.label)
);
NAV_BY_ROLE.ADMIN = [
  NAV_BY_ROLE.SUPER_ADMIN.find((item) => item.href === "/admin/users")!,
  ...OPERATIONAL_ADMIN_NAV,
  { label: "Applicants", href: "/admin/applicants", icon: UserCheck },
];
NAV_BY_ROLE.SUPER_ADMIN.splice(3, 0, { label: "Family Links", href: "/admin/family-links", icon: Users });
NAV_BY_ROLE.ADMIN.splice(3, 0, { label: "Family Links", href: "/admin/family-links", icon: Users });
NAV_BY_ROLE.NURSERY_HEAD = OPERATIONAL_ADMIN_NAV.filter(
  (item) => !["/admin/exams", "/admin/subjects"].includes(item.href)
);
NAV_BY_ROLE.PRIMARY_HEAD = OPERATIONAL_ADMIN_NAV.filter((item) => item.href !== "/admin/subjects");
NAV_BY_ROLE.PRINCIPAL = OPERATIONAL_ADMIN_NAV.filter((item) => item.href !== "/admin/subjects");

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-brand-500", FORM_TEACHER: "bg-emerald-500",
  ADMIN: "bg-blue-500", NURSERY_HEAD: "bg-pink-500", PRIMARY_HEAD: "bg-cyan-500",
  PRINCIPAL: "bg-indigo-500", SUBJECT_TEACHER: "bg-yellow-500",
  BURSAR_ACCOUNTANT:"bg-emerald-600", SECRETARY:"bg-cyan-600",
  PARENT: "bg-purple-500", APPLICANT: "bg-slate-500", STUDENT: "bg-cyan-500",
};
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:"Super Admin", FORM_TEACHER:"Form Teacher",
  ADMIN:"School Admin", NURSERY_HEAD:"Nursery Head", PRIMARY_HEAD:"Primary Head",
  PRINCIPAL:"Secondary Principal", SUBJECT_TEACHER:"Subject Teacher",
  BURSAR_ACCOUNTANT:"Bursar / Accountant", SECRETARY:"Secretary",
  PARENT:"Parent", APPLICANT:"Applicant", STUDENT:"Student",
};

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);

  const role = session?.user?.role as string | undefined;
  const nav  = role ? NAV_BY_ROLE[role] ?? [] : [];

  useEffect(() => {
    const activeGroup = nav.find((item) =>
      item.children?.some((child) => pathname === child.href)
    );
    if (activeGroup) setExpanded(activeGroup.href);
  }, [nav, pathname]);

  if (!session?.user || !role) return null;

  return (
    <>
    {open && <button className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={onClose} aria-label="Close navigation" />}
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex min-h-screen w-64 flex-shrink-0 flex-col bg-brand-950 transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0",
      open ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-white"/>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
          <div>
            <span className="font-display font-bold text-white text-base block leading-none">SchoolPortal</span>
            <span className="text-xs text-brand-400 mt-0.5 block">Management System</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon, children }) => {
          const childIsActive = children?.some((child) => pathname === child.href) ?? false;
          const isActive  = childIsActive || pathname === href || (href !== "/admin/dashboard" && href !== "/teacher/dashboard" && href !== "/parent/dashboard" && pathname.startsWith(href));
          const isExpanded = expanded === href;

          if (children) {
            return (
              <div key={href}>
                <div className={cn("nav-item-inactive w-full gap-0 p-0", isActive && "nav-item-active")}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0"/>
                    <span>{label}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : href)}
                    className="flex self-stretch items-center px-3 hover:bg-white/10"
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label} menu`}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5"/> : <ChevronRight className="w-3.5 h-3.5"/>}
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {children.map(c => (
                      <Link key={c.href} href={c.href} onClick={onClose}
                        className={cn("block px-2 py-2 text-xs rounded-lg transition-colors", pathname === c.href ? "text-white font-semibold" : "text-slate-400 hover:text-white")}>
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link key={href} href={href} onClick={onClose} className={cn(isActive ? "nav-item-active" : "nav-item-inactive")}>
              <Icon className="w-4 h-4 flex-shrink-0"/>{label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link href="/account/security" onClick={onClose} className={cn(pathname === "/account/security" ? "nav-item-active" : "nav-item-inactive")}>
          <LockKeyhole className="w-4 h-4 flex-shrink-0"/>Change password
        </Link>
        <Link href="/notifications" onClick={onClose} className="nav-item-inactive">
          <Bell className="w-4 h-4 flex-shrink-0"/>Notifications
        </Link>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold", ROLE_COLOR[role])}>
            {session.user.name?.charAt(0) ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">{session.user.name}</div>
            <div className="text-xs text-slate-400">{ROLE_LABEL[role]}</div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="nav-item-inactive w-full"
        >
          <LogOut className="w-4 h-4"/>Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
