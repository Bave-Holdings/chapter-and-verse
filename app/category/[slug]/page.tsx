import type { Metadata } from "next";
import { KnowledgeWorkspace } from "../../home/workspace";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug.toUpperCase()} | Chapter & Verse` };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <KnowledgeWorkspace key={slug} categoryMode initialAgentSlug={slug} />;
}
