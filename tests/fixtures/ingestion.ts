import type { Agent, DocumentIngest, GuidelineDocument } from "../../lib/api/types";

export const adminUser = { id: "admin-1", full_name: "Test Admin", email: "admin@example.test", role: "admin", created_at: "2026-01-01T00:00:00Z" };
export const ingestionAgents: Agent[] = ["mortgage_guidelines", "fha_handbook", "combined_guidelines"].map((key, index) => ({
  key, slug: ["mortgage", "fha", "combined"][index], name: ["Fannie Mae", "FHA", "Combined guidelines"][index],
  live: true, kb_label: "Guidelines", empty_title: "Ask a question", empty_sub: "", placeholder: "Ask", chips: [],
  document_count: 0, pages_ingested: 0, total_pages: 0, has_documents: false,
}));
export const guidelineDocument: GuidelineDocument = {
  id: "11111111-1111-4111-8111-111111111111", name: "guide.pdf", source_path: "/private/guide.pdf",
  page_count: 0, total_pages: 10, content_start_page: 1, status: "partial", agent_key: "mortgage_guidelines",
  document_family: "fannie", section_profile_version: "v1", version: "v2026", created_at: "2026-10-05T00:00:00Z",
};
export const rangeJob: DocumentIngest = {
  id: "22222222-2222-4222-8222-222222222222", document_id: guidelineDocument.id, document_name: guidelineDocument.name,
  start_page: 1, end_page: 10, status: "pending", pages: 0, section_pages: 0, section_pages_total: 10,
  chunks: 0, sections: 0, error: null, created_at: "2026-10-05T00:00:00Z", updated_at: "2026-10-05T00:00:00Z",
};
