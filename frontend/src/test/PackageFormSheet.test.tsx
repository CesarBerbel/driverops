import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as categoriesApi from "@/features/categories/api";
import * as servicesApi from "@/features/services/api";
import { PackageFormSheet } from "@/features/services/PackageFormSheet";
import type { Service, ServicePackage } from "@/features/services/types";

vi.mock("@/features/services/api");
vi.mock("@/features/categories/api");
vi.mock("@/features/parts/api");

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: "Troca de óleo",
    category: 1,
    category_name: "Mecânica",
    description: "",
    labor_cost: "200.00",
    estimated_minutes: null,
    notes: "",
    standard_parts: [],
    value: "200.00",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderSheet(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PackageFormSheet open packageId={null} onOpenChange={onOpenChange} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe("PackageFormSheet", () => {
  beforeEach(() => {
    vi.mocked(servicesApi.createServicePackage).mockReset();
    vi.mocked(servicesApi.listServices).mockReset();
    vi.mocked(servicesApi.createService).mockReset();
    vi.mocked(servicesApi.listServices).mockResolvedValue([]);
    vi.mocked(categoriesApi.listCategories).mockReset();
    vi.mocked(categoriesApi.listCategories).mockResolvedValue([
      {
        id: 1,
        category_type: "service",
        name: "Mecânica",
        description: "",
        notes: "",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("requires a name and at least one service", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("O nome do pacote é obrigatório.")).toBeInTheDocument();
    expect(screen.getByText("Adicione ao menos um serviço.")).toBeInTheDocument();
    expect(servicesApi.createServicePackage).not.toHaveBeenCalled();
  });

  it("adds services, computes the live total, and applies a percentual discount", async () => {
    vi.mocked(servicesApi.listServices).mockResolvedValue([
      service({ id: 1, name: "Troca de óleo", value: "200.00" }),
      service({ id: 2, name: "Alinhamento", value: "100.00" }),
    ]);
    vi.mocked(servicesApi.createServicePackage).mockResolvedValue({} as ServicePackage);
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome do pacote"), "Pacote Revisão");

    // Add both services via the combobox.
    await user.click(screen.getByPlaceholderText("Buscar serviço pelo nome..."));
    await user.click(await screen.findByRole("button", { name: /Troca de óleo/ }));
    await user.click(screen.getByPlaceholderText("Buscar serviço pelo nome..."));
    await user.click(await screen.findByRole("button", { name: /Alinhamento/ }));

    // Live total = 200 + 100 = 300.
    expect(screen.getByTestId("package-total")).toHaveTextContent("R$ 300,00");
    expect(screen.getByTestId("package-final")).toHaveTextContent("R$ 300,00");

    // Apply a 10% discount -> final 270.
    await user.click(screen.getByLabelText("Tipo de desconto"));
    await user.click(screen.getByRole("option", { name: "Percentual" }));
    await user.type(screen.getByLabelText("Desconto (%)"), "10");
    await waitFor(() =>
      expect(screen.getByTestId("package-final")).toHaveTextContent("R$ 270,00"),
    );

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(servicesApi.createServicePackage).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Pacote Revisão",
          discount_type: "percent",
          discount_value: "10",
          items: [{ service: 1 }, { service: 2 }],
        }),
      ),
    );
  });

  it("applies a fixed discount to the live final value", async () => {
    vi.mocked(servicesApi.listServices).mockResolvedValue([
      service({ id: 1, name: "Troca de óleo", value: "300.00" }),
    ]);
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome do pacote"), "Pacote");
    await user.click(screen.getByPlaceholderText("Buscar serviço pelo nome..."));
    await user.click(await screen.findByRole("button", { name: /Troca de óleo/ }));

    await user.click(screen.getByLabelText("Tipo de desconto"));
    await user.click(screen.getByRole("option", { name: "Valor fixo" }));
    await user.type(screen.getByLabelText("Desconto (R$)"), "5000");
    // 5000 cents -> R$ 50,00 discount -> final 250.
    await waitFor(() =>
      expect(screen.getByTestId("package-final")).toHaveTextContent("R$ 250,00"),
    );
  });

  it("can remove a service from the package before saving", async () => {
    vi.mocked(servicesApi.listServices).mockResolvedValue([
      service({ id: 1, name: "Troca de óleo", value: "200.00" }),
    ]);
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome do pacote"), "Pacote");
    await user.click(screen.getByPlaceholderText("Buscar serviço pelo nome..."));
    await user.click(await screen.findByRole("button", { name: /Troca de óleo/ }));
    expect(screen.getByTestId("package-total")).toHaveTextContent("R$ 200,00");

    await user.click(screen.getByRole("button", { name: "Remover serviço" }));
    expect(screen.getByTestId("package-total")).toHaveTextContent("R$ 0,00");
    expect(screen.getByText("Nenhum serviço adicionado ainda.")).toBeInTheDocument();
  });

  it("creates a service inline and auto-adds it to the package without losing data", async () => {
    vi.mocked(servicesApi.createService).mockResolvedValue(
      service({ id: 9, name: "Serviço Novo", value: "150.00" }),
    );
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText("Nome do pacote"), "Pacote Inline");

    await user.click(screen.getByRole("button", { name: /adicionar serviço/i }));
    const dialog = await screen.findByRole("dialog", { name: "Novo serviço" });
    await user.type(within(dialog).getByLabelText("Nome do serviço"), "Serviço Novo");
    await user.click(within(dialog).getByLabelText("Categoria do serviço"));
    await user.click(await screen.findByRole("option", { name: "Mecânica" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(servicesApi.createService).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Novo serviço" })).not.toBeInTheDocument();
    // Package name preserved, new service auto-added, total reflects it.
    expect(screen.getByLabelText("Nome do pacote")).toHaveValue("Pacote Inline");
    expect(screen.getByText("Serviço Novo")).toBeInTheDocument();
    expect(screen.getByTestId("package-total")).toHaveTextContent("R$ 150,00");
    // The inline service-save must not have submitted the package form.
    expect(servicesApi.createServicePackage).not.toHaveBeenCalled();
  });
});
