import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ButtonLoader,
  EngineLoader,
  LoadingOverlay,
  LoadingState,
  TableSkeleton,
} from "@/components/loading";

describe("EngineLoader", () => {
  it("exposes an accessible status with screen-reader text", () => {
    render(<EngineLoader label="Carregando dados da OS..." />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Carregando dados da OS...")).toBeInTheDocument();
  });

  it("falls back to a default sr-only text when no label is given", () => {
    render(<EngineLoader />);
    expect(screen.getByText("Carregando, aguarde.")).toBeInTheDocument();
  });

  it("renders the V-engine piston animation", () => {
    const { container } = render(<EngineLoader />);
    expect(container.querySelectorAll(".engine-piston")).toHaveLength(2);
    expect(container.querySelector(".engine-crank")).toBeInTheDocument();
  });
});

describe("ButtonLoader", () => {
  it("shows the visible processing label", () => {
    render(<ButtonLoader label="Salvando..." />);
    // Aparece como texto visível e também no sr-only (getAllByText).
    expect(screen.getAllByText("Salvando...").length).toBeGreaterThan(0);
  });
});

describe("LoadingOverlay", () => {
  it("does not render when inactive", () => {
    render(<LoadingOverlay active={false} label="Gerando..." />);
    expect(screen.queryByText("Gerando...")).not.toBeInTheDocument();
  });

  it("renders a busy overlay when active", () => {
    const { container } = render(<LoadingOverlay active label="Gerando orçamento..." />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getAllByText("Gerando orçamento...").length).toBeGreaterThan(0);
  });
});

describe("LoadingState", () => {
  it("renders the loading state", () => {
    render(<LoadingState isLoading loadingLabel="Carregando dados...">conteúdo</LoadingState>);
    expect(screen.getByText("Carregando dados...")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
  });

  it("renders an error state with retry", () => {
    const onRetry = vi.fn();
    render(<LoadingState isError onRetry={onRetry}>x</LoadingState>);
    expect(
      screen.getByText("Não foi possível carregar os dados. Tente novamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("renders empty and forbidden states", () => {
    const { rerender } = render(<LoadingState isEmpty>x</LoadingState>);
    expect(screen.getByText("Nenhum registro encontrado.")).toBeInTheDocument();
    rerender(<LoadingState isForbidden>x</LoadingState>);
    expect(screen.getByText("Você não tem permissão para ver esta área.")).toBeInTheDocument();
  });

  it("renders children when idle", () => {
    render(<LoadingState>pronto</LoadingState>);
    expect(screen.getByText("pronto")).toBeInTheDocument();
  });
});

describe("TableSkeleton", () => {
  it("renders a busy status with the requested number of rows", () => {
    const { container } = render(<TableSkeleton rows={3} columns={2} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    // 1 header row + 3 body rows.
    expect(container.querySelectorAll(".grid")).toHaveLength(4);
  });
});
