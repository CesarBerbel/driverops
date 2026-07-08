export type AIProvider = "anthropic" | "openai" | "gemini" | "custom";

export interface AISettings {
  is_active: boolean;
  provider: AIProvider;
  provider_display: string;
  model: string;
  base_url: string;
  api_key_env: string;
  temperature: number;
  max_tokens: number;
  timeout_seconds: number;
  global_prompt: string;
  log_texts: boolean;
  retention_days: number;
  key_configured: boolean;
  updated_at: string;
  updated_by_name: string | null;
}

export type AISettingsPayload = Partial<
  Omit<AISettings, "provider_display" | "key_configured" | "updated_at" | "updated_by_name">
>;

export interface AIFieldInstruction {
  id: number;
  field_key: string;
  field_key_display: string;
  name: string;
  description: string;
  instruction: string;
  tone: string;
  detail_level: string;
  audience: string;
  can_rewrite: boolean;
  can_fix_grammar: boolean;
  can_summarize: boolean;
  can_expand: boolean;
  use_context: boolean;
  allowed_context: string[];
  preserve_technical_terms: boolean;
  keep_first_person: boolean;
  remove_slang: boolean;
  visible_to_customer: boolean;
  is_active: boolean;
  is_customized: boolean;
  updated_at: string;
  updated_by_name: string | null;
}

export type AIFieldInstructionPayload = Partial<
  Omit<
    AIFieldInstruction,
    "id" | "field_key" | "field_key_display" | "is_customized" | "updated_at" | "updated_by_name"
  >
>;

export interface AIActionMeta {
  key: string;
  label: string;
  required_flag: string | null;
}

export interface AIKeyLabel {
  key: string;
  label: string;
}

export interface AIFieldMeta extends AIKeyLabel {
  active?: boolean;
  can_rewrite?: boolean;
  can_fix_grammar?: boolean;
  can_summarize?: boolean;
  can_expand?: boolean;
}

export interface AIMetadata {
  active: boolean;
  fields: AIFieldMeta[];
  actions: AIActionMeta[];
  tones: AIKeyLabel[];
  detail_levels: AIKeyLabel[];
  audiences: AIKeyLabel[];
  context_groups: AIKeyLabel[];
}

export interface AIGenerateRequest {
  field: string;
  action: string;
  text: string;
  work_order?: number;
}

export interface AISuggestion {
  suggestion: string;
  field: string;
  action: string;
  provider: string;
  model: string;
  log_id: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface AIUsageLog {
  id: number;
  user_name: string | null;
  work_order: number | null;
  field_key: string;
  action: string;
  provider: string;
  model: string;
  status: "success" | "failed";
  status_display: string;
  error_code: string;
  input_tokens: number | null;
  output_tokens: number | null;
  is_test: boolean;
  applied: boolean | null;
  created_at: string;
}

// Erro de IA carregado com código (para o frontend distinguir mensagens).
export interface AIErrorBody {
  detail: string;
  code?: string;
}
