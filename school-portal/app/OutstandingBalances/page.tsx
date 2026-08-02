import { redirect } from "next/navigation";

export default function LegacyOutstandingBalancesPage() {
  redirect("/finance/outstanding");
}
