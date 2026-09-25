import { Suspense } from "react";

import { WorkspaceShell } from "../home/workspace-shell";
import { WorkspaceLoading } from "../home/workspace";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<WorkspaceLoading />}>
    <WorkspaceShell>{children}</WorkspaceShell>
  </Suspense>;
}
