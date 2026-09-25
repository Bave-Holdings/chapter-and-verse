"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";

import { KnowledgeWorkspace } from "./workspace";

// The route group keeps this shell mounted while the router changes its content.
// Read URL state here because server layouts do not receive updated search params.
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ slug?: string }>();
  const searchParams = useSearchParams();
  const category = pathname === "/category" || pathname.startsWith("/category/");

  return <KnowledgeWorkspace
    routeKey={pathname}
    categoryMode={category || pathname === "/home/chat"}
    profile={pathname === "/profile"}
    initialAgentSlug={params.slug ?? "mortgage"}
    initialChatId={category ? searchParams.get("chat") ?? undefined : undefined}
  >{children}</KnowledgeWorkspace>;
}
