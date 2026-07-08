import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { AiFieldActions } from "@/features/ai/components/AiFieldActions";
import type { AIMetadata } from "@/features/ai/types";

vi.mock("@/features/ai/api");
import * as api from "@/features/ai/api";

const perms = vi.hoisted(() => ({ codes: new Set<string>(["ai.use"]) }));
vi.mock("@/features/auth/usePermission", () => ({
  usePermissionCheck: () => (code: string) => perms.codes.has(code),
  useHasPermission: (code: string) => perms.codes.has(code),
}));

const METADATA: AIMetadata = {
  active: true,
  fields: [
    {
      key: "diagnosis",
      label: "Diagnóstico técnico",
      active: true,
      can_rewrite: false,
      can_fix_grammar: true,
      can_summarize: false,
      can_expand: false,
    },
  ],
  actions: [
    { key: "improve", label: "Melhorar texto", required_flag: null },
    { key: "fix_grammar", label: "Corrigir português", required_flag: "can_fix_grammar" },
    { key: "professional", label: "Tornar mais profissional", required_flag: "can_rewrite" },
  ],
  tones: [],
  detail_levels: [],
  audiences: [],
  context_groups: [],
};

function renderActions(props: Partial<Parameters<typeof AiFieldActions>[0]> = {}) {
  const onApply = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AiFieldActions
        fieldKey="diagnosis"
        value="bieleta com folga"
        onApply={onApply}
        {...props}
      />
      <Toaster />
    </QueryClientProvider>,
  );
  return { onApply };
}

beforeEach(() => {
  perms.codes = new Set(["ai.use"]);
  vi.mocked(api.getAIMetadata).mockResolvedValue(METADATA);
  vi.mocked(api.markAIUsageOutcome).mockResolvedValue();
  vi.mocked(api.generateAISuggestion).mockResolvedValue({
    suggestion: "Constatada folga na bieleta dianteira.",
    field: "diagnosis",
    action: "improve",
    provider: "anthropic",
    model: "claude-opus-4-8",
    log_id: 7,
    input_tokens: 10,
    output_tokens: 6,
  });
});

describe("AiFieldActions", () => {
  it("shows the AI button when enabled", async () => {
    renderActions();
    expect(
      await screen.findByRole("button", { name: "Ações de IA para o campo" }),
    ).toBeInTheDocument();
  });

  it("is hidden without the ai.use permission", async () => {
    perms.codes = new Set();
    renderActions();
    await new Promise((r) => setTimeout(r, 20));
    expect(
      screen.queryByRole("button", { name: "Ações de IA para o campo" }),
    ).not.toBeInTheDocument();
  });

  it("is hidden when the module is inactive", async () => {
    vi.mocked(api.getAIMetadata).mockResolvedValue({ ...METADATA, active: false });
    renderActions();
    await new Promise((r) => setTimeout(r, 20));
    expect(
      screen.queryByRole("button", { name: "Ações de IA para o campo" }),
    ).not.toBeInTheDocument();
  });

  it("only offers actions allowed for the field", async () => {
    renderActions();
    await screen.findByRole("button", { name: "Ações de IA para o campo" });
    await userEvent.click(screen.getByRole("button", { name: "Ações de IA para o campo" }));
    expect(await screen.findByText("Melhorar texto")).toBeInTheDocument();
    expect(screen.getByText("Corrigir português")).toBeInTheDocument();
    // 'professional' exige can_rewrite (false) → não deve aparecer.
    expect(screen.queryByText("Tornar mais profissional")).not.toBeInTheDocument();
  });

  it("previews the suggestion and only applies on confirmation", async () => {
    const { onApply } = renderActions();
    await screen.findByRole("button", { name: "Ações de IA para o campo" });
    await userEvent.click(screen.getByRole("button", { name: "Ações de IA para o campo" }));
    await userEvent.click(await screen.findByText("Melhorar texto"));

    // A sugestão aparece na prévia; o texto original NÃO foi aplicado ainda.
    expect(
      await screen.findByDisplayValue("Constatada folga na bieleta dianteira."),
    ).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Aplicar sugestão" }));
    expect(onApply).toHaveBeenCalledWith("Constatada folga na bieleta dianteira.");
    await waitFor(() =>
      expect(api.markAIUsageOutcome).toHaveBeenCalledWith(7, true),
    );
  });

  it("discards without changing the original text", async () => {
    const { onApply } = renderActions();
    await screen.findByRole("button", { name: "Ações de IA para o campo" });
    await userEvent.click(screen.getByRole("button", { name: "Ações de IA para o campo" }));
    await userEvent.click(await screen.findByText("Melhorar texto"));
    await screen.findByRole("button", { name: "Descartar" });
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("preserves the original text when generation fails", async () => {
    vi.mocked(api.generateAISuggestion).mockRejectedValue(new Error("falha"));
    const { onApply } = renderActions();
    await screen.findByRole("button", { name: "Ações de IA para o campo" });
    await userEvent.click(screen.getByRole("button", { name: "Ações de IA para o campo" }));
    await userEvent.click(await screen.findByText("Melhorar texto"));
    await waitFor(() => expect(api.generateAISuggestion).toHaveBeenCalled());
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByText("Aplicar sugestão")).not.toBeInTheDocument();
  });
});
