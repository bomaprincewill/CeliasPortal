import Providers from "@/components/layout/Providers";
import DashboardShell from "@/components/layout/DashboardShell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <DashboardShell>
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">{children}</div>
      </DashboardShell>
    </Providers>
  );
}
