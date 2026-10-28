export type User = {
  id: string;
  full_name?: string | null;
  email: string;
  role: string;
  created_at: string;
};

export type IngestRangeResponse = {
  job_id: string;
  document_id: string;
  document_name: string;
  from_page: number;
  to_page: number;
  status: string;
};

export type DocumentIngest = {
  id: string;
  document_id: string;
  start_page: number;
  end_page: number;
  status: string;
  pages: number;
  section_pages: number;
  section_pages_total: number;
  chunks: number;
  sections: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  document_name: string | null;
};

export type GuidelineDocument = {
  id: string;
  name: string;
  source_path: string;
  page_count: number;
  total_pages: number;
  content_start_page: number;
  status: string;
  agent_key: string;
  document_family: string;
  section_profile_version: string;
  version: string;
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
  /** guideline | practice | overlay | comparison | calculation; saved answers may lack it. */
  kind?: SourceKind | string | null;
  /** Older name for `kind`, still read for saved answers. */
  source_kind?: string | null;
  cited_passages?: Array<{
    claim: string;
    passage: string;
    page_number: number;
  }>;
};

export type SourceKind = "guideline" | "practice" | "overlay" | "comparison" | "calculation";

/** Eligibility Breakdown chips, worst first. */
export type Chip = "ineligible" | "not_yet" | "open" | "discretion" | "condition" | "met";

export type AusFinding = "approve" | "refer" | "manual";

/** Computed by the backend from the worst breakdown chip, never written by the model. */
export type EligibilityOutlook = {
  chip: Chip;
  label: string;
  basis: string;
  items: string[];
};

export type SourceIds = {
  source_ids: number[];
};

export type AnswerPresentation = {
  answer_kind?: "simple" | "borrower_scenario" | null;
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
  /** Absent on answers saved before the chips. */
  outlook?: EligibilityOutlook | null;
  borrower_script: string | null;
  key_callout: string | null;
  statuses: Array<
    SourceIds & {
      /** Legacy class; answers saved before the chips have only this. */
      type?: "clear" | "fixable" | "blocker" | null;
      chip?: Chip | null;
      decides?: string | null;
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
  /** detail and basis are filled by code for letters of explanation. */
  documents: Array<SourceIds & { label: string; detail?: string | null; basis?: string | null }>;
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

export type OverlayRule = {
  id: string;
  title: string;
  body: string;
  position: number;
};

export type OverlaySet = {
  agent_key: string;
  source_name: string | null;
  rules: OverlayRule[];
  loaded_at: string | null;
};

export type OverlayClear = {
  agent_key: string;
  deactivated: number;
};
