import { redirect } from "next/navigation";
import ChatResearch from "@/components/ChatResearch";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ResearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  if (!query) redirect("/");

  return <ChatResearch initialQuery={query} />;
}
