import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Providers from "@/components/layout/Providers";
import DashboardShell from "@/components/layout/DashboardShell";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function AccountSecurityPage() {
  const session = await getSession();
  if (!session) redirect("/auth/signin");
  return <Providers><DashboardShell><div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8"><div className="page-header"><h1 className="page-title">Account security</h1><p className="page-subtitle">Manage the password for {session.user.email}.</p></div><ChangePasswordForm/></div></DashboardShell></Providers>;
}
