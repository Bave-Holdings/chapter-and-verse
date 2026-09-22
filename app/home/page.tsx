import type { Metadata } from "next";

import { KnowledgeWorkspace } from "./workspace";

export const metadata: Metadata = {
  title: "Knowledge Hub | Chapter & Verse",
  description: "Your Chapter & Verse knowledge hub. Find the answers you need, all in one place.",
};

export default function HomePage() {
  return <KnowledgeWorkspace />;
}
