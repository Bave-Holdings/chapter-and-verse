export type User = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

export type Agent = {
  key: string;
  slug: string;
  name: string;
  live: boolean;
  kb_label: string;
  empty_title: string;
  empty_sub: string;
  placeholder: string;
  chips: string[];
  document_count: number;
  pages_ingested: number;
  total_pages: number;
  has_documents: boolean;
};

export type CitationSource = {
  index: number;
  document_id: string;
  doc_name: string;
  source_path: string;
  page_number: number;
  section_id: string | null;
  sub_section_id: string | null;
  citation_url: string;
  text_preview?: string;
  score?: number | null;
  title?: string | null;
  chunk_id?: string | null;
  document_version?: string | null;
};

export type Chat = {
  id: string;
  user_id: string;
  agent_key: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | string;
  content: string;
  status: string | null;
  sources: CitationSource[];
  analysis: Record<string, unknown> | null;
  audit_id: string | null;
  created_at: string;
};

export type ChatDetail = Chat & { messages: ChatMessage[] };

export type AskResult = {
  status: string;
  question?: string;
  answer?: string | null;
  sources?: CitationSource[];
  first_pass_scores?: number[];
  max_score?: number;
  model?: string | null;
  latency_ms?: number;
  error?: string | null;
  audit_id?: string | null;
  analysis?: Record<string, unknown> | null;
};

export type StreamEvent =
  | { event: "status"; data: { message?: string; phase?: string; is_retrieving?: boolean } }
  | { event: "sources"; data: { sources: CitationSource[]; max_score?: number; first_pass_scores?: number[] } }
  | { event: "token"; data: { text: string } }
  | { event: "done"; data: AskResult }
  | { event: "error"; data: AskResult };
