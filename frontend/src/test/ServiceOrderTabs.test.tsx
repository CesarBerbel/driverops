import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ServiceOrderTabs,
  type ServiceOrderTabDef,
} from "@/features/orders/components/ServiceOrderTabs";

const TABS: ServiceOrderTabDef[] = [
  { key: "main", label: "Veículo e cliente" },
  { key: "report", label: "Relato e diagnóstico", hasError: true },
  { key: "photos", label: "Fotos", disabled: true, disabledHint: "Salve a OS." },
];

describe("ServiceOrderTabs", () => {
  it("shows an error indicator on tabs with errors", () => {
    render(
      <ServiceOrderTabs tabs={TABS} active="main" onChange={vi.fn()}>
        <div>panel</div>
      </ServiceOrderTabs>,
    );
    const reportTab = screen.getByRole("tab", { name: /Relato e diagnóstico/ });
    expect(within(reportTab).getByLabelText("Contém erros")).toBeInTheDocument();
    const mainTab = screen.getByRole("tab", { name: "Veículo e cliente" });
    expect(within(mainTab).queryByLabelText("Contém erros")).toBeNull();
  });

  it("calls onChange when an enabled tab is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ServiceOrderTabs tabs={TABS} active="main" onChange={onChange}>
        <div>panel</div>
      </ServiceOrderTabs>,
    );
    await user.click(screen.getByRole("tab", { name: /Relato e diagnóstico/ }));
    expect(onChange).toHaveBeenCalledWith("report");
  });

  it("does not switch to a disabled tab", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ServiceOrderTabs tabs={TABS} active="main" onChange={onChange}>
        <div>panel</div>
      </ServiceOrderTabs>,
    );
    const photosTab = screen.getByRole("tab", { name: "Fotos" });
    expect(photosTab).toBeDisabled();
    await user.click(photosTab);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("changes the whole tab on a horizontal finger swipe over the content", () => {
    const onChange = vi.fn();
    render(
      <ServiceOrderTabs tabs={TABS} active="main" onChange={onChange}>
        <div>panel</div>
      </ServiceOrderTabs>,
    );
    const panel = screen.getByRole("tabpanel");
    // Deslize para a esquerda (dx negativo) -> próxima aba habilitada (report).
    fireEvent.touchStart(panel, { touches: [{ clientX: 260, clientY: 120 }] });
    fireEvent.touchMove(panel, { touches: [{ clientX: 110, clientY: 128 }] });
    fireEvent.touchEnd(panel);
    expect(onChange).toHaveBeenCalledWith("report");
  });

  it("skips disabled tabs when swiping (jumps to the next enabled one)", () => {
    const onChange = vi.fn();
    // "report" desabilitada: a partir de "main", o swipe deve pular para "photos".
    const tabs: ServiceOrderTabDef[] = [
      { key: "main", label: "Veículo e cliente" },
      { key: "report", label: "Relato", disabled: true },
      { key: "photos", label: "Fotos" },
    ];
    render(
      <ServiceOrderTabs tabs={tabs} active="main" onChange={onChange}>
        <div>panel</div>
      </ServiceOrderTabs>,
    );
    const panel = screen.getByRole("tabpanel");
    fireEvent.touchStart(panel, { touches: [{ clientX: 260, clientY: 120 }] });
    fireEvent.touchMove(panel, { touches: [{ clientX: 110, clientY: 126 }] });
    fireEvent.touchEnd(panel);
    expect(onChange).toHaveBeenCalledWith("photos");
  });
});
