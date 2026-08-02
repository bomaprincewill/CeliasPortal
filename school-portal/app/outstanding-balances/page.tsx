import { redirect } from "next/navigation";

export default function LegacyOutstandingBalancesKebabPage() {
  redirect("/finance/outstanding");
}
