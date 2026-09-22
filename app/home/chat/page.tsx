import type { Metadata } from "next";

import { KnowledgeWorkspace } from "../workspace";

export const metadata: Metadata = {
  title: "Chat | Chapter & Verse",
  description: "Explore a conversation in your Chapter & Verse knowledge hub.",
};

export default function ChatPage() {
  return <KnowledgeWorkspace categoryMode initialAgentSlug="mortgage" />;
}
