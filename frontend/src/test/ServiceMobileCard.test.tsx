import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ServiceMobileCard } from "@/features/services/components/ServiceMobileCard";
import type { Service } from "@/features/services/types";

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: "Troca de óleo",
    category: 1,
    category_name: "Mecânica",
    description: "",
    labor_cost: "100.00",
    estimated_minutes: 45,
    notes: "",
    standard_parts: [],
    value: "250.00",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ServiceMobileCard", () => {
  it("shows the service name, category, value, duration and active status", () => {
    render(<ServiceMobileCard service={service()} />);
    expect(screen.getByText("Troca de óleo")).toBeInTheDocument();
    expect(screen.getByText("Mecânica")).toBeInTheDocument();
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it("shows the inactive status when active is false", () => {
    render(<ServiceMobileCard service={service()} active={false} />);
    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(screen.queryByText("Ativo")).not.toBeInTheDocument();
  });

  it("triggers onEdit from the name and the edit action", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<ServiceMobileCard service={service()} onEdit={onEdit} />);
    await user.click(screen.getByRole("button", { name: "Troca de óleo" }));
    await user.click(screen.getByLabelText("Editar serviço"));
    expect(onEdit).toHaveBeenCalledTimes(2);
  });
});
