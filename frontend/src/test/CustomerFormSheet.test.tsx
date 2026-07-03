import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as customersApi from "@/features/customers/api";
import * as cepService from "@/features/customers/cepService";
import { CustomerFormSheet } from "@/features/customers/CustomerFormSheet";

vi.mock("@/features/customers/api");
vi.mock("@/features/customers/cepService");

function renderSheet(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CustomerFormSheet open customerId={null} onOpenChange={onOpenChange} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("CustomerFormSheet", () => {
  beforeEach(() => {
    vi.mocked(customersApi.createCustomer).mockReset();
    vi.mocked(cepService.lookupCep).mockReset();
  });

  it("defaults customer type to Pessoa Física and labels the document field as CPF", async () => {
    renderSheet();
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent("Pessoa Física"),
    );
    expect(screen.getByText("Documento (CPF)")).toBeInTheDocument();
  });

  it("switches the document field to CNPJ when the type changes to Pessoa Jurídica", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pessoa Jurídica" }));

    expect(await screen.findByText("Documento (CNPJ)")).toBeInTheDocument();
  });

  it("submits with only the name filled in and closes the sheet", async () => {
    vi.mocked(customersApi.createCustomer).mockResolvedValue({
      id: 1,
      name: "John Doe",
      customer_type: "individual",
      email: "",
      phone: "",
      whatsapp: "",
      document: "",
      zip_code: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      country: "Brasil",
      notes: "",
      vehicle_count: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    await user.type(screen.getByLabelText("Nome"), "John Doe");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(customersApi.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ name: "John Doe", customer_type: "individual" }),
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("auto-fills the address when a full CEP is typed and found", async () => {
    vi.mocked(cepService.lookupCep).mockResolvedValue({
      status: "found",
      address: {
        street: "Avenida Paulista",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
      },
    });
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("CEP"), "01310100");

    await waitFor(() => expect(cepService.lookupCep).toHaveBeenCalledWith("01310100"));
    expect(await screen.findByDisplayValue("Avenida Paulista")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bela Vista")).toBeInTheDocument();
    expect(screen.getByDisplayValue("São Paulo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SP")).toBeInTheDocument();
  });

  it("shows an 'open in WhatsApp' link once a valid number is entered", async () => {
    const user = userEvent.setup();
    renderSheet();

    expect(
      screen.queryByRole("link", { name: "Abrir conversa no WhatsApp" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("WhatsApp"), "11912345678");

    const link = screen.getByRole("link", { name: "Abrir conversa no WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/5511912345678");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows a friendly message and does not block the form when the CEP is not found", async () => {
    vi.mocked(cepService.lookupCep).mockResolvedValue({ status: "not_found" });
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("CEP"), "00000000");

    expect(
      await screen.findByText("CEP não encontrado. Preencha o endereço manualmente."),
    ).toBeInTheDocument();
    // The rest of the form is still usable.
    await user.type(screen.getByLabelText("Cidade"), "Minha Cidade");
    expect(screen.getByDisplayValue("Minha Cidade")).toBeInTheDocument();
  });
});
