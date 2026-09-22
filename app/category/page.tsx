import type { Metadata } from "next";
import { KnowledgeWorkspace } from "../home/workspace";

export const metadata: Metadata = {
  title: "Category | Chapter & Verse",
  description: "Browse policies and conversations in your knowledge hub.",
};

export default function CategoryPage() {
  return <KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />;
}
