import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug.toUpperCase()} | Chapter & Verse` };
}

export default function CategoryPage() {
  return null;
}
