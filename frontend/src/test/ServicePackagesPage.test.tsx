import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import * as servicesApi from "@/features/services/api";
import { ServicePackagesPage } from "@/features/services/pages/ServicePackagesPage";
import type { ServicePackage } from "@/features/services/types";

vi.mock("@/features/services/api");

function servicePackage(overrides: Partial<ServicePackage> = {}): ServicePackage {
  return {
    id: 1,
    name: "Pacote Revisão",
    description: "",
    items: [
      { service: 1, service_name: "Troca de óleo", service_value: "100.00" },
      { service: 2, service_name: "Alinhamento", service_value: "150.00" },
    ],
    total_value: "250.00",
    discount_type: "none",
    discount_value: "0.00",
    final_value: "250.00",
    notes: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/services/packages"]}>
        <ServicePackagesPage />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

describe("ServicePackagesPage", () => {
  beforeEach(() => {
    vi.mocked(servicesApi.listServicePackages).mockReset();
    vi.mocked(servicesApi.deleteServicePackage).mockReset();
    vi.mocked(servicesApi.reactivateServicePackage).mockReset();
  });

  it("renders the heading and 'Novo pacote' button", async () => {
    vi.mocked(servicesApi.listServicePackages).mockResolvedValue([]);
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Pacotes de Serviços" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /novo pacote/i }).length).toBeGreaterThan(0);
  });

  it("shows the empty state", async () => {
    vi.mocked(servicesApi.listServicePackages).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Nenhum pacote cadastrado ainda.")).toBeInTheDocument();
  });

  it("lists packages with service count and final value", async () => {
    vi.mocked(servicesApi.listServicePackages).mockResolvedValue([servicePackage()]);
    renderPage();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Pacote Revisão")).toBeInTheDocument();
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(within(table).getByText("R$ 250,00")).toBeInTheDocument();
  });

  it("switches to the inactive filter and shows Reativar instead of Excluir", async () => {
    vi.mocked(servicesApi.listServicePackages).mockResolvedValue([servicePackage()]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Pacote Revisão");
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Pacotes desabilitados" }));
    await waitFor(() =>
      expect(servicesApi.listServicePackages).toHaveBeenLastCalledWith({
        search: undefined,
        status: "inactive",
      }),
    );
    expect(screen.getByLabelText("Reativar pacote")).toBeInTheDocument();
    expect(screen.queryByLabelText("Excluir pacote")).not.toBeInTheDocument();
  });

  it("soft-deletes a package through the confirm dialog", async () => {
    vi.mocked(servicesApi.listServicePackages).mockResolvedValue([servicePackage()]);
    vi.mocked(servicesApi.deleteServicePackage).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Pacote Revisão");
    await user.click(screen.getByLabelText("Excluir pacote"));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(servicesApi.deleteServicePackage).toHaveBeenCalledWith(1, expect.anything()),
    );
  });
});
