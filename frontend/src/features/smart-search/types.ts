export type SearchEntityType =
  | "work_order"
  | "customer"
  | "vehicle"
  | "lead"
  | "financial";

export interface SearchResult {
  type: SearchEntityType;
  id: number;
  title: string;
  subtitle: string;
  status: string | null;
  date: string | null;
  snippet: string;
  reason: string;
  url: string;
  score: number;
}

export interface SearchGroup {
  type: SearchEntityType;
  label: string;
  results: SearchResult[];
}

export interface AppliedFilter {
  label: string;
  value: string;
}

export interface SmartSearchResponse {
  query: string;
  interpreted: {
    entities: string[];
    period: string | null;
    statuses: string[];
    terms: string[];
  };
  applied_filters: AppliedFilter[];
  results: SearchResult[];
  groups: SearchGroup[];
  total: number;
  truncated: boolean;
  used_ai: boolean;
  used_semantic: boolean;
}

export interface RecentSearch {
  id: number;
  query: string;
  updated_at: string;
}

export interface SavedSearch {
  id: number;
  label: string;
  query: string;
  filters: Record<string, unknown>;
  created_at: string;
}

export interface SearchSuggestions {
  starters: string[];
  saved: SavedSearch[];
}

export interface SmartSearchSettings {
  use_ai: boolean;
  include_internal_notes: boolean;
  include_financial: boolean;
  result_limit: number;
  store_history: boolean;
  log_queries: boolean;
  retention_days: number;
  semantic_enabled: boolean;
  embedding_provider: string;
  embedding_model: string;
  embedding_base_url: string;
  embedding_api_key_env: string;
  embedding_dimensions: number;
  similarity_threshold: number;
  updated_at?: string;
}
