import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";
import { OrderForm } from "@/features/orders/components/OrderForm";
import * as ordersApi from "@/features/orders/api";
import type { WorkOrder } from "@/features/orders/types";
import * as customersApi from "@/features/customers/api";
import * as vehiclesApi from "@/features/vehicles/api";
import type { Vehicle } from "@/features/vehicles/types";
import * as servicesApi from "@/features/services/api";
import type { Service } from "@/features/services/types";
import * as partsApi from "@/features/parts/api";
import * as settingsApi from "@/features/settings/api";
import type { OrderSettings } from "@/features/settings/types";

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, is_superuser: true, permissions: [] } }),
}));

vi.mock("@/features/orders/api");
vi.mock("@/features/customers/api");
vi.mock("@/features/vehicles/api");
vi.mock("@/features/services/api");
vi.mock("@/features/parts/api");
vi.mock("@/features/settings/api");

function orderSettings(days: number): OrderSettings {
  return {
    default_delivery_days: days,
    warranty_terms: "",
    quote_terms: "",
    service_authorization_terms: "",
    customer_acknowledgment_terms: "",
    default_os_notes: "",
    pdf_footer_text: "",
    print_instructions: "",
    general_conditions: "",
    notify_customer_by_email: true,
    notify_statuses: ["ready", "finished"],
    notify_on_creation: false,
    notify_on_payment: false,
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    customer: 1,
    customer_name: "Maria Silva",
    customer_whatsapp: "11987654321",
    license_plate: "ABC1234",
    brand: "Fiat",
    model: "Uno",
    version: "",
    manufacture_year: null,
    model_year: null,
    color: "",
    mileage: null,
    fuel_type: "",
    transmission: "",
    steering: "",
    doors: null,
    air_conditioning: null,
    is_modified: null,
    modification_notes: "",
    vehicle_type: "",
    usage_category: "",
    chassis: "",
    renavam: "",
    fipe_code: "",
    notes: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 10,
    name: "Troca de óleo",
    category: 1,
    category_name: "Mecânica",
    description: "",
    labor_cost: "100.00",
    estimated_minutes: null,
    notes: "",
    standard_parts: [],
    value: "100.00",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function workOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 1,
    number: 1,
    customer: 1,
    customer_name: "Maria Silva",
    customer_whatsapp: "11987654321",
    customer_phone: "",
    vehicle: 1,
    vehicle_plate: "ABC1234",
    vehicle_description: "Fiat Uno",
    status: "open",
    status_display: "Aberta",
    assigned_technician: null,
    assigned_technician_name: null,
    opened_at: "2026-07-04",
    expected_delivery: "2026-07-11",
    current_mileage: null,
    customer_report: "Barulho",
    diagnosis: "",
    internal_notes: "",
    service_items: [],
    package_items: [],
    part_items: [],
    discount_type: "none",
    discount_value: "0.00",
    services_total: "0.00",
    packages_total: "0.00",
    parts_total: "0.00",
    gross_total: "0.00",
    final_value: "0.00",
    amount_paid: "0.00",
    balance_due: "0.00",
    payment_status: "open",
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
    ...overrides,
  };
}

function formTree(order: WorkOrder | null, queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrderForm order={order} onCancel={vi.fn()} />
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

function renderForm(order: WorkOrder | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(formTree(order, queryClient));
  return { queryClient, ...view };
}

describe("OrderForm", () => {
  beforeEach(() => {
    vi.mocked(ordersApi.createWorkOrder).mockReset();
    vi.mocked(customersApi.listCustomers).mockReset().mockResolvedValue([]);
    vi.mocked(vehiclesApi.listVehicles).mockReset().mockResolvedValue([]);
    vi.mocked(servicesApi.listServices).mockReset().mockResolvedValue([]);
    vi.mocked(servicesApi.listServicePackages).mockReset().mockResolvedValue([]);
    vi.mocked(partsApi.listParts).mockReset().mockResolvedValue([]);
    vi.mocked(settingsApi.getOrderSettings).mockReset().mockResolvedValue(orderSettings(7));
  });

  it("blocks submit and jumps to the first tab with errors", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    // Jumps to the first tab with errors (Veículo e cliente).
    expect(await screen.findByText("Selecione um veículo.")).toBeInTheDocument();
    expect(screen.getByText("Selecione um cliente.")).toBeInTheDocument();
    // The "Relato e diagnóstico" tab shows an error indicator...
    const reportTab = screen.getByRole("tab", { name: /Relato e diagnóstico/ });
    expect(within(reportTab).getByLabelText("Contém erros")).toBeInTheDocument();
    // ...and its error is visible once that tab is opened.
    await user.click(reportTab);
    expect(screen.getByText("O relato do cliente é obrigatório.")).toBeInTheDocument();
    expect(ordersApi.createWorkOrder).not.toHaveBeenCalled();
  });

  it("auto-fills the customer when a vehicle is picked by plate", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByPlaceholderText("Buscar veículo pela placa..."));
    await user.click(await screen.findByRole("button", { name: /ABC-1234/ }));

    // Customer name and a clickable WhatsApp link appear automatically.
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /98765-4321/ });
    expect(link).toHaveAttribute("href", "https://wa.me/5511987654321");
  });

  it("adds a service line, computes totals, and submits the payload", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    vi.mocked(servicesApi.listServices).mockResolvedValue([service()]);
    vi.mocked(ordersApi.createWorkOrder).mockResolvedValue({ id: 5 } as WorkOrder);
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByPlaceholderText("Buscar veículo pela placa..."));
    await user.click(await screen.findByRole("button", { name: /ABC-1234/ }));

    await user.click(screen.getByRole("tab", { name: /Relato e diagnóstico/ }));
    await user.type(screen.getByLabelText("Relato do cliente"), "Barulho no motor");

    await user.click(screen.getByRole("tab", { name: /Serviços e peças/ }));
    await user.click(screen.getByPlaceholderText("Buscar serviço pelo nome..."));
    await user.click(await screen.findByRole("button", { name: /Troca de óleo/ }));

    await user.click(screen.getByRole("tab", { name: /Resumo e valores/ }));
    expect(screen.getByTestId("order-services-total")).toHaveTextContent("R$ 100,00");
    expect(screen.getByTestId("order-gross-total")).toHaveTextContent("R$ 100,00");
    expect(screen.getByTestId("order-final-value")).toHaveTextContent("R$ 100,00");

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(ordersApi.createWorkOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 1,
          vehicle: 1,
          customer_report: "Barulho no motor",
          service_items: [
            { service: 10, description: "Troca de óleo", quantity: "1", unit_price: "100" },
          ],
        }),
      ),
    );
    // Ao salvar, permanece na OS (mostra o toast de sucesso, sem voltar à lista).
    expect(await screen.findByText("Ordem de serviço criada.")).toBeInTheDocument();
  });

  it("prefills the expected delivery from the default deadline on a new OS", async () => {
    vi.mocked(settingsApi.getOrderSettings).mockResolvedValue(orderSettings(7));
    renderForm();
    await waitFor(() => expect(settingsApi.getOrderSettings).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Data de abertura"), {
      target: { value: "2026-08-01" },
    });
    // 2026-08-01 + 7 dias = 2026-08-08.
    await waitFor(() =>
      expect(screen.getByLabelText("Previsão de entrega")).toHaveValue("2026-08-08"),
    );
  });

  it("locks the customer and vehicle when editing an existing OS", async () => {
    renderForm(workOrder());

    // Both are shown as read-only selections...
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText(/ABC-1234/)).toBeInTheDocument();
    expect(
      screen.getByText("O cliente não pode ser alterado após a abertura da OS."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("O veículo não pode ser alterado após a abertura da OS."),
    ).toBeInTheDocument();

    // ...with no way to change or clear them.
    expect(
      screen.queryByRole("button", { name: /adicionar cliente/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /adicionar veículo/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trocar cliente")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trocar veículo")).not.toBeInTheDocument();
  });

  it("refreshes the status select when the loaded OS changes", async () => {
    const { queryClient, rerender } = renderForm(workOrder());

    expect(screen.getByLabelText("Status da OS")).toHaveTextContent("Aberta");

    rerender(
      formTree(
        workOrder({
          status: "diagnosing",
          status_display: "Em diagnóstico",
          updated_at: "2026-07-04T00:01:00Z",
        }),
        queryClient,
      ),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Status da OS")).toHaveTextContent(
        "Em diagnóstico",
      ),
    );
  });

  it("adds a custom (avulso) service line requiring a description", async () => {
    vi.mocked(vehiclesApi.listVehicles).mockResolvedValue([vehicle()]);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByPlaceholderText("Buscar veículo pela placa..."));
    await user.click(await screen.findByRole("button", { name: /ABC-1234/ }));

    await user.click(screen.getByRole("tab", { name: /Relato e diagnóstico/ }));
    await user.type(screen.getByLabelText("Relato do cliente"), "x");

    await user.click(screen.getByRole("tab", { name: /Serviços e peças/ }));
    await user.click(screen.getByRole("button", { name: "Serviço avulso" }));
    // The custom row exposes an editable description input.
    expect(screen.getByPlaceholderText("Descrição do item")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe uma descrição.")).toBeInTheDocument();
  });
});
