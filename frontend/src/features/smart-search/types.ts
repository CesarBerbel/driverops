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
