import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "@/features/landing/pages/LandingPage";
import type { LandingData } from "@/features/landing/types";

vi.mock("@/features/landing/api");
import * as api from "@/features/landing/api";

const FULL: LandingData = {
  workshop: {
    trade_name: "Bandeirantes Auto Mecânica",
    legal_name: "Bandeirantes LTDA",
    cnpj: "12345678000190",
    email: "contato@bandeirantes.com",
    phone: "1133334444",
    whatsapp: "11999998888",
    website: "https://bandeirantes.com",
    business_hours: "Seg a Sex, 8h às 18h",
    logo: "",
    address_line: "Rua das Oficinas, 100 - Centro - São Paulo - SP",
    city: "São Paulo",
    state: "SP",
    zip_code: "01000000",
  },
  services: [
    { name: "Diagnóstico automotivo", description: "Identificação técnica de falhas." },
    { name: "Troca de óleo", description: "Óleo e filtros adequados." },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getLandingData).mockResolvedValue(FULL);
});

describe("LandingPage", () => {
  it("renders the main institutional sections", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /Cuidamos do seu carro/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marcas que atendemos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por que escolher a gente?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Serviços prestados" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Como funciona o atendimento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "O que nossos clientes dizem" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dúvidas frequentes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contato e localização" })).toBeInTheDocument();
  });

  it("uses real workshop data and services from the API", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /Cuidamos do seu carro/i });
    // Serviços vindos da API (não o catálogo padrão).
    expect(screen.getByRole("heading", { name: "Diagnóstico automotivo" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sistema de freios" })).not.toBeInTheDocument();
    // Dados reais da oficina.
    expect(within(document.body).getAllByText("Seg a Sex, 8h às 18h").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rua das Oficinas, 100/).length).toBeGreaterThan(0);
  });

  it("uses the request form as the primary CTA (no admin login as primary)", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /Cuidamos do seu carro/i });
    // CTA comercial principal (abre o formulário), não "Entrar".
    expect(
      screen.getAllByRole("button", { name: /Pedir marcação de horário/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^Entrar$/i })).not.toBeInTheDocument();
    // WhatsApp continua como link direto.
    const wa = screen.getAllByRole("link", { name: /WhatsApp/i }).map((a) => a.getAttribute("href"));
    expect(wa.some((h) => h?.includes("wa.me/5511999998888"))).toBe(true);
    // Acesso administrativo discreto no rodapé.
    expect(screen.getByRole("link", { name: "Área da oficina" })).toBeInTheDocument();
  });

  it("degrades gracefully when workshop data is missing", async () => {
    vi.mocked(api.getLandingData).mockResolvedValue({
      workshop: {
        trade_name: "",
        legal_name: "",
        cnpj: "",
        email: "",
        phone: "",
        whatsapp: "",
        website: "",
        business_hours: "",
        logo: "",
        address_line: "",
        city: "",
        state: "",
        zip_code: "",
      },
      services: [],
    });
    renderPage();
    await screen.findByRole("heading", { name: /Cuidamos do seu carro/i });
    // Serviços caem no catálogo padrão (fallback).
    expect(screen.getByRole("heading", { name: "Sistema de freios" })).toBeInTheDocument();
    // Endereço ausente mostra estado neutro.
    expect(screen.getByText(/Endereço ainda não configurado/)).toBeInTheDocument();
    // CTA comercial presente mesmo sem dados.
    expect(
      screen.getAllByRole("button", { name: /Pedir marcação de horário/i }).length,
    ).toBeGreaterThan(0);
  });
});
