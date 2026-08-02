import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import StudentExamClient from "./StudentExamClient";

export default async function StudentExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const session = await getSession();
  if (!session || session.user.role !== "STUDENT") redirect("/auth/signin");
  return <StudentExamClient examId={examId} />;
}
