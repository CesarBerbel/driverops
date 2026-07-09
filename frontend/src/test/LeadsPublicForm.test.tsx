import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicRequestForm } from "@/features/leads/components/PublicRequestForm";
import type { LeadPublicConfig } from "@/features/leads/types";

vi.mock("@/features/leads/api");
import * as api from "@/features/leads/api";

const CONFIG: LeadPublicConfig = {
  is_active: true,
  email_required: false,
  plate_required: false,
  allow_without_vehicle: true,
  require_consent: true,
  request_types: [{ key: "diagnostic", label: "Diagnóstico" }],
  periods: [{ key: "any", label: "Qualquer horário" }],
};

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PublicRequestForm open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getLeadPublicConfig).mockResolvedValue(CONFIG);
  vi.mocked(api.submitLeadRequest).mockResolvedValue({ detail: "Pedido recebido com sucesso." });
});

describe("PublicRequestForm", () => {
  it("submits a contact request without login and shows success", async () => {
    renderForm();
    await screen.findByLabelText("Seu nome *");
    fireEvent.change(screen.getByLabelText("Seu nome *"), { target: { value: "João Souza" } });
    fireEvent.change(screen.getByLabelText("Telefone / WhatsApp *"), {
      target: { value: "(11) 99999-8888" },
    });
    await userEvent.click(screen.getByRole("checkbox", { name: "Autorizo o contato" }));

    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));

    await waitFor(() =>
      expect(api.submitLeadRequest).toHaveBeenCalledWith(
        expect.objectContaining({ name: "João Souza", phone: "(11) 99999-8888", consent: true }),
      ),
    );
    expect(await screen.findByText("Pedido recebido!")).toBeInTheDocument();
  });

  it("masks the phone as the visitor types raw digits", async () => {
    renderForm();
    const phone = await screen.findByLabelText("Telefone / WhatsApp *");
    fireEvent.change(phone, { target: { value: "11999998888" } });
    expect(phone).toHaveValue("(11) 99999-8888");
  });

  it("normalizes the plate (uppercase, no separators, max 7)", async () => {
    vi.mocked(api.getLeadPublicConfig).mockResolvedValue({
      ...CONFIG,
      allow_without_vehicle: false,
    });
    renderForm();
    const plate = await screen.findByLabelText("Placa");
    fireEvent.change(plate, { target: { value: "abc-1d23xyz" } });
    expect(plate).toHaveValue("ABC1D23");
  });

  it("keeps submit disabled without consent when required", async () => {
    renderForm();
    await screen.findByLabelText("Seu nome *");
    fireEvent.change(screen.getByLabelText("Seu nome *"), { target: { value: "João" } });
    fireEvent.change(screen.getByLabelText("Telefone / WhatsApp *"), {
      target: { value: "11999998888" },
    });
    expect(screen.getByRole("button", { name: "Enviar pedido" })).toBeDisabled();
  });
});
