import Image from "next/image";
import schoolLogo from "@/public/celias-portal-logo.png";

export default function SchoolLogo({ className = "h-10 w-10", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>
      <Image src={schoolLogo} alt="Celia's International School logo" sizes="64px" priority={priority} className="h-full w-full object-contain" />
    </span>
  );
}
