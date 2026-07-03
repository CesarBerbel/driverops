import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as customersApi from "@/features/customers/api";
import * as cepService from "@/features/customers/cepService";
import { CustomerFormPage } from "@/features/customers/pages/CustomerFormPage";

vi.mock("@/features/customers/api");
vi.mock("@/features/customers/cepService");

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/customers/new"]}>
        <Routes>
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers" element={<div>Customers list page</div>} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("CustomerFormPage", () => {
  beforeEach(() => {
    vi.mocked(customersApi.createCustomer).mockReset();
    vi.mocked(cepService.lookupCep).mockReset();
  });

  it("defaults customer type to Pessoa Física and labels the document field as CPF", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveTextContent("Pessoa Física"),
    );
    expect(screen.getByText("Documento (CPF)")).toBeInTheDocument();
  });

  it("switches the document field to CNPJ when the type changes to Pessoa Jurídica", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pessoa Jurídica" }));

    expect(await screen.findByText("Documento (CNPJ)")).toBeInTheDocument();
  });

  it("submits with only the name filled in", async () => {
    vi.mocked(customersApi.createCustomer).mockResolvedValue({
      id: 1,
      name: "John Doe",
      customer_type: "individual",
      email: "",
      phone: "",
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
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Nome"), "John Doe");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(customersApi.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ name: "John Doe", customer_type: "individual" }),
      ),
    );
    await screen.findByText("Customers list page");
  });

  it("auto-fills the address when a full CEP is typed and found", async () => {
    vi.mocked(cepService.lookupCep).mockResolvedValue({
      status: "found",
      address: { street: "Avenida Paulista", neighborhood: "Bela Vista", city: "São Paulo", state: "SP" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("CEP"), "01310100");

    await waitFor(() => expect(cepService.lookupCep).toHaveBeenCalledWith("01310100"));
    expect(await screen.findByDisplayValue("Avenida Paulista")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bela Vista")).toBeInTheDocument();
    expect(screen.getByDisplayValue("São Paulo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SP")).toBeInTheDocument();
  });

  it("shows a friendly message and does not block the form when the CEP is not found", async () => {
    vi.mocked(cepService.lookupCep).mockResolvedValue({ status: "not_found" });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("CEP"), "00000000");

    expect(
      await screen.findByText("CEP não encontrado. Preencha o endereço manualmente."),
    ).toBeInTheDocument();
    // The rest of the form is still usable.
    await user.type(screen.getByLabelText("Cidade"), "Minha Cidade");
    expect(screen.getByDisplayValue("Minha Cidade")).toBeInTheDocument();
  });
});
