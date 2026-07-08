import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { AiSettingsPage } from "@/features/ai/pages/AiSettingsPage";
import type { AIFieldInstruction, AIMetadata, AISettings } from "@/features/ai/types";

vi.mock("@/features/ai/api");
import * as api from "@/features/ai/api";

const perms = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

const SETTINGS: AISettings = {
  is_active: true,
  provider: "anthropic",
  provider_display: "Anthropic (Claude)",
  model: "claude-opus-4-8",
  base_url: "",
  api_key_env: "",
  temperature: 0.3,
  max_tokens: 1200,
  timeout_seconds: 30,
  global_prompt: "Nunca invente informações.",
  log_texts: false,
  retention_days: 30,
  key_configured: false,
  updated_at: "2026-07-08T10:00:00Z",
  updated_by_name: null,
};

const METADATA: AIMetadata = {
  active: true,
  fields: [{ key: "diagnosis", label: "Diagnóstico técnico" }],
  actions: [{ key: "improve", label: "Melhorar texto", required_flag: null }],
  tones: [{ key: "technical", label: "Técnico" }],
  detail_levels: [{ key: "normal", label: "Equilibrado" }],
  audiences: [{ key: "customer", label: "Cliente" }],
  context_groups: [{ key: "diagnosis", label: "Diagnóstico existente" }],
};

const INSTRUCTION: AIFieldInstruction = {
  id: 1,
  field_key: "diagnosis",
  field_key_display: "Diagnóstico técnico",
  name: "Diagnóstico técnico",
  description: "Diagnóstico do problema.",
  instruction: "Reescreva o diagnóstico.",
  tone: "technical",
  detail_level: "normal",
  audience: "customer",
  can_rewrite: true,
  can_fix_grammar: true,
  can_summarize: true,
  can_expand: true,
  use_context: true,
  allowed_context: ["diagnosis"],
  preserve_technical_terms: true,
  keep_first_person: false,
  remove_slang: true,
  visible_to_customer: true,
  is_active: true,
  is_customized: false,
  updated_at: "2026-07-08T10:00:00Z",
  updated_by_name: null,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AiSettingsPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  perms.codes = new Set(["ai.view"]);
  vi.mocked(api.getAISettings).mockResolvedValue(SETTINGS);
  vi.mocked(api.getAIMetadata).mockResolvedValue(METADATA);
  vi.mocked(api.listAIFieldInstructions).mockResolvedValue([INSTRUCTION]);
  vi.mocked(api.listAIUsageLogs).mockResolvedValue([]);
});

describe("AiSettingsPage", () => {
  it("renders the configuration with provider and global prompt", async () => {
    renderPage();
    expect(
      await screen.findByText("Assistente de IA para Textos da OS"),
    ).toBeInTheDocument();
    expect(await screen.findByDisplayValue("claude-opus-4-8")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Nunca invente informações.")).toBeInTheDocument();
  });

  it("gates editing behind the ai.edit permission", async () => {
    perms.codes = new Set(["ai.view"]); // sem ai.edit
    renderPage();
    await screen.findByText("Status e provedor");
    expect(
      screen.getByText(/permissão "Editar configurações de IA"/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
  });

  it("shows the save button with the ai.edit permission", async () => {
    perms.codes = new Set(["ai.view", "ai.edit"]);
    renderPage();
    expect(
      (await screen.findAllByRole("button", { name: "Salvar" })).length,
    ).toBeGreaterThan(0);
  });
});
