import type { Metadata } from "next";
import { OverlaysPanel } from "../../../admin/overlays/overlays-panel";

export const metadata: Metadata = {
  title: "Lender overlays | Chapter & Verse",
  description: "Load the lender's overlay rules that answers apply and label as overlays.",
};

export default function OverlaysPage() {
  return <OverlaysPanel />;
}
