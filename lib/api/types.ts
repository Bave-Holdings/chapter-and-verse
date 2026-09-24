export type User = {
  id: string;
  full_name?: string | null;
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
  page_number: number;
  section_id: string | null;
  sub_section_id: string | null;
  title?: string | null;
  document_version?: string | null;
  text_preview?: string | null;
  citation_url?: string | null;
  chunk_id?: string | null;
  source_kind?: string | null;
  cited_passages?: Array<{
    claim: string;
    passage: string;
    page_number: number;
  }>;
};

export type SourceIds = {
  source_ids: number[];
};

export type AnswerPresentation = {
  scope: {
    label: string;
    detail: string;
    not_found: boolean;
  };
  verdict: SourceIds & {
    type: "clear" | "fixable" | "blocker" | "notfound";
    kicker: string;
    text: string;
    reason: string;
  };
  borrower_script: string | null;
  key_callout: string | null;
  statuses: Array<
    SourceIds & {
      type: "clear" | "fixable" | "blocker";
      item: string;
      reason: string;
    }
  >;
  steps: Array<
    SourceIds & {
      title: string;
      bullets: string[];
      stop_if: string | null;
      watch_out: string | null;
    }
  >;
  plan_b: Array<
    SourceIds & {
      when: string;
      title: string;
      bullets: string[];
    }
  >;
  easiest_fix: string | null;
  donts: Array<SourceIds & { text: string }>;
  documents: Array<SourceIds & { label: string }>;
  next_fact_needed: string | null;
  verify_line: string | null;
  citation_passages?: Array<{
    source_id: number;
    claim: string;
    passage: string;
  }>;
};

export type AnswerUiState = {
  completed_step_ids: string[];
  checked_document_ids: string[];
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
  presentation: AnswerPresentation | null;
  ui_state: AnswerUiState;
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
  presentation?: AnswerPresentation | null;
  message_id?: string | null;
};

export type StreamEvent =
  | { event: "status"; data: { message?: string; phase?: string; is_retrieving?: boolean } }
  | { event: "sources"; data: { sources: CitationSource[]; max_score?: number; first_pass_scores?: number[] } }
  | { event: "token"; data: { text: string } }
  | { event: "presentation"; data: { presentation: AnswerPresentation } }
  | { event: "done"; data: AskResult }
  | { event: "error"; data: AskResult };
