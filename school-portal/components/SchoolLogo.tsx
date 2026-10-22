import Image from "next/image";
import schoolLogo from "@/public/celias-school-logo.png";

export default function SchoolLogo({ className = "h-12 w-12", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white p-0.5 ${className}`}>
      <Image src={schoolLogo} alt="Celia's International School logo" sizes="80px" priority={priority} className="h-full w-full object-contain" />
    </span>
  );
}
