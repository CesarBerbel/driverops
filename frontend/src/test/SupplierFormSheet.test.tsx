import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as suppliersApi from "@/features/suppliers/api";
import { SupplierFormSheet } from "@/features/suppliers/SupplierFormSheet";
import * as cepService from "@/lib/cepService";

vi.mock("@/features/suppliers/api");
vi.mock("@/lib/cepService");

function renderSheet(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SupplierFormSheet open supplierId={null} onOpenChange={onOpenChange} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("SupplierFormSheet", () => {
  beforeEach(() => {
    vi.mocked(suppliersApi.createSupplier).mockReset();
    vi.mocked(cepService.lookupCep).mockReset();
  });

  it("defaults supplier type to Pessoa Jurídica and labels the document field as CNPJ", async () => {
    renderSheet();
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent("Pessoa Jurídica"),
    );
    expect(screen.getByText("Documento (CNPJ)")).toBeInTheDocument();
  });

  it("switches the document field to CPF when the type changes to Pessoa Física", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pessoa Física" }));

    expect(await screen.findByText("Documento (CPF)")).toBeInTheDocument();
  });

  it("submits with only the name filled in and closes the sheet", async () => {
    vi.mocked(suppliersApi.createSupplier).mockResolvedValue({
      id: 1,
      name: "Fornecedor Ltda",
      trade_name: "",
      supplier_type: "company",
      document: "",
      state_registration: "",
      email: "",
      phone: "",
      whatsapp: "",
      contact_name: "",
      zip_code: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      country: "Brasil",
      notes: "",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    await user.type(screen.getByLabelText("Nome/Razão social"), "Fornecedor Ltda");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(suppliersApi.createSupplier).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Fornecedor Ltda", supplier_type: "company" }),
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
