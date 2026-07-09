import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { formatPhone } from "@/lib/masks";

import { getLandingData } from "../api";
import { BrandCarousel } from "../components/BrandCarousel";
import { BrandMark } from "../components/BrandMark";
import { PublicFooter } from "../components/PublicFooter";
import { PublicHeader } from "../components/PublicHeader";
import { PublicRequestForm } from "@/features/leads/components/PublicRequestForm";
import {
  BRANDS,
  FAQ,
  HERO_BADGES,
  HOW_STEPS,
  SERVICES_FALLBACK,
  TESTIMONIALS,
  WHY_CHOOSE,
} from "../constants";
import { mailHref, mapsUrl, telHref, waLink } from "../contact";
import type { PublicWorkshop } from "../types";
import { useLandingSeo } from "../useLandingSeo";

const EMPTY_WORKSHOP: PublicWorkshop = {
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
};

function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-16 px-4 py-16 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function LandingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-landing"],
    queryFn: getLandingData,
    staleTime: 5 * 60 * 1000,
  });

  const workshop = data?.workshop ?? EMPTY_WORKSHOP;
  useLandingSeo(data?.workshop);

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<string | undefined>(undefined);
  function openForm(type?: string) {
    setFormType(type);
    setFormOpen(true);
  }

  const name = workshop.trade_name || workshop.legal_name || "Auto Mecânica";
  const waHref = workshop.whatsapp ? waLink(workshop.whatsapp) : "#contato";

  const services =
    data?.services && data.services.length > 0
      ? data.services.map((s) => ({ icon: Wrench, title: s.name, description: s.description }))
      : SERVICES_FALLBACK;

  // Depoimentos configurados pela oficina; na ausência, usa os exemplos.
  const testimonials =
    data?.testimonials && data.testimonials.length > 0 ? data.testimonials : TESTIMONIALS;

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-[#0b0d12] text-white">
        <Loader2 className="size-8 animate-spin text-[#5b8bff]" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-[#0b0d12] text-white">
      <PublicHeader workshop={workshop} onRequest={() => openForm()} />

      {/* HERO */}
      <Section id="inicio" className="relative overflow-hidden py-20 sm:py-28">
        <div
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-[#2a4fd6]/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 top-40 size-72 rounded-full bg-[#e11d2a]/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <span className="size-2 rounded-full bg-[#e11d2a]" /> Auto mecânica de confiança
            </span>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Cuidamos do seu carro com{" "}
              <span className="text-[#5b8bff]">tecnologia</span>,{" "}
              <span className="text-[#5b8bff]">transparência</span> e confiança.
            </h1>
            <p className="max-w-xl text-base text-white/70 sm:text-lg">
              Atendimento completo para diagnóstico, manutenção e reparos automotivos, com
              acompanhamento claro da sua ordem de serviço e orçamento aprovado antes da
              execução.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openForm()}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#2a4fd6] px-6 text-base font-semibold text-white shadow-lg shadow-[#2a4fd6]/20 transition-colors hover:bg-[#2340ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8bff]"
              >
                <CalendarClock className="size-5" />
                Pedir marcação de horário
              </button>
              <button
                type="button"
                onClick={() => openForm("quote")}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/20 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8bff]"
              >
                <FileText className="size-5" />
                Pedir orçamento ou diagnóstico
              </button>
              {workshop.whatsapp && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#25d366]/40 px-6 text-base font-semibold text-[#4ade80] transition-colors hover:bg-[#25d366]/10"
                >
                  <MessageCircle className="size-5" />
                  WhatsApp
                </a>
              )}
            </div>

            <ul className="flex flex-wrap gap-2 pt-2" aria-label="Destaques">
              {HERO_BADGES.map((badge) => (
                <li
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75"
                >
                  <CheckCircle2 className="size-3.5 text-[#5b8bff]" />
                  {badge}
                </li>
              ))}
            </ul>
          </div>

          {/* Visual da marca */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-2xl border-2 border-[#2a4fd6] bg-black p-8 shadow-2xl">
              <div className="flex flex-col items-center gap-4 py-6">
                <BrandMark logo={workshop.logo} name={name} eager />
                <p className="text-center text-sm text-white/60">
                  Diagnóstico, revisão e manutenção com processo organizado e comunicação
                  clara em todas as etapas.
                </p>
                <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center text-xs">
                  {["Diagnóstico", "Orçamento", "Execução"].map((step, i) => (
                    <div key={step} className="rounded-lg border border-white/10 bg-white/5 py-3">
                      <span className="block text-lg font-bold text-[#5b8bff]">{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* MARCAS */}
      <Section id="marcas" className="bg-[#0e1017]">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Marcas que atendemos</h2>
          <p className="mt-2 text-white/60">
            Trabalhamos com diversas marcas nacionais e importadas.
          </p>
        </div>
        <BrandCarousel brands={BRANDS} />
      </Section>

      {/* DIFERENCIAIS */}
      <Section id="diferenciais">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Por que escolher a gente?</h2>
          <p className="mt-2 text-white/60">
            Organização, qualidade técnica e comunicação clara em cada etapa.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_CHOOSE.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-[#2a4fd6]/50 hover:bg-white/[0.06]"
            >
              <span className="mb-3 inline-flex size-11 items-center justify-center rounded-lg bg-[#2a4fd6]/15 text-[#5b8bff]">
                <Icon className="size-6" />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-white/60">{description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* SERVIÇOS */}
      <Section id="servicos" className="bg-[#0e1017]">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Serviços prestados</h2>
          <p className="mt-2 text-white/60">Cuidado completo para o seu veículo.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-[#2a4fd6]/50"
            >
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#2a4fd6]/15 text-[#5b8bff]">
                <Icon className="size-6" />
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                {description && (
                  <p className="mt-1 text-sm text-white/60">{description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => openForm()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2a4fd6] px-6 font-semibold text-white hover:bg-[#2340ba]"
          >
            <CalendarClock className="size-5" />
            Solicitar atendimento
          </button>
        </div>
      </Section>

      {/* COMO FUNCIONA */}
      <Section id="como-funciona">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Como funciona o atendimento</h2>
          <p className="mt-2 text-white/60">Um processo organizado e transparente do início ao fim.</p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <span className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-[#2a4fd6] text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-xs text-white/55">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* CTA INTERMEDIÁRIO */}
      <Section className="bg-gradient-to-r from-[#1a2a6c] to-[#2a4fd6]">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Precisa revisar ou diagnosticar seu veículo?
          </h2>
          <p className="max-w-2xl text-white/85">
            Agende um atendimento e receba orientação da nossa equipe.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => openForm()}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 font-semibold text-[#1a2a6c] hover:bg-white/90"
            >
              <CalendarClock className="size-5" />
              Pedir marcação de horário
            </button>
            {workshop.whatsapp && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/50 px-6 font-semibold text-white hover:bg-white/10"
              >
                <MessageCircle className="size-5" />
                Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </Section>

      {/* DEPOIMENTOS */}
      <Section id="depoimentos" className="bg-[#0e1017]">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">O que nossos clientes dizem</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="mb-2 flex gap-0.5" aria-label={`${t.rating} de 5 estrelas`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-4 ${i < t.rating ? "fill-[#facc15] text-[#facc15]" : "text-white/20"}`}
                  />
                ))}
              </div>
              <blockquote className="flex-1 text-sm text-white/75">“{t.quote}”</blockquote>
              <figcaption className="mt-3 text-sm">
                <span className="font-semibold">{t.name}</span>
                {t.service && <span className="block text-xs text-white/50">{t.service}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* SOBRE */}
      <Section id="sobre">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold sm:text-3xl">Sobre a {name}</h2>
            <p className="text-white/70">
              Somos uma oficina focada em atendimento transparente, diagnóstico técnico e
              manutenção automotiva com responsabilidade. Nosso objetivo é cuidar do seu
              veículo com organização, qualidade e comunicação clara em todas as etapas.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {["Transparência", "Qualidade técnica", "Organização", "Proximidade com o cliente"].map(
                (value) => (
                  <li key={value} className="inline-flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle2 className="size-4 text-[#5b8bff]" />
                    {value}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { k: "Orçamento", v: "antes da execução" },
                { k: "Aprovação", v: "total ou parcial" },
                { k: "Histórico", v: "registrado na OS" },
              ].map((item) => (
                <div key={item.k}>
                  <p className="text-sm font-semibold text-[#5b8bff]">{item.k}</p>
                  <p className="mt-1 text-xs text-white/55">{item.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="bg-[#0e1017]">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Dúvidas frequentes</h2>
        </div>
        <div className="mx-auto max-w-3xl divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {FAQ.map((item) => (
            <details key={item.question} className="group bg-white/[0.02]">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-medium marker:content-none hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5b8bff]">
                {item.question}
                <ChevronRight className="size-4 shrink-0 text-white/50 transition-transform group-open:rotate-90" />
              </summary>
              <p className="px-5 pb-4 text-sm text-white/65">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* CONTATO */}
      <Section id="contato">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold sm:text-3xl">Contato e localização</h2>
            <p className="text-white/60">{name}</p>
            <ul className="space-y-3 text-sm">
              {workshop.phone && (
                <li>
                  <a href={telHref(workshop.phone)} className="inline-flex items-center gap-3 hover:text-[#5b8bff]">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-white/5">
                      <Phone className="size-4" />
                    </span>
                    {formatPhone(workshop.phone)}
                  </a>
                </li>
              )}
              {workshop.whatsapp && (
                <li>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 hover:text-[#4ade80]"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-white/5">
                      <MessageCircle className="size-4" />
                    </span>
                    {formatPhone(workshop.whatsapp)} · WhatsApp
                  </a>
                </li>
              )}
              {workshop.email && (
                <li>
                  <a href={mailHref(workshop.email)} className="inline-flex items-center gap-3 hover:text-[#5b8bff]">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-white/5">
                      <Mail className="size-4" />
                    </span>
                    {workshop.email}
                  </a>
                </li>
              )}
              {workshop.address_line && (
                <li>
                  <a
                    href={mapsUrl(workshop.address_line)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-3 hover:text-[#5b8bff]"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                      <MapPin className="size-4" />
                    </span>
                    {workshop.address_line}
                  </a>
                </li>
              )}
              {workshop.business_hours && (
                <li className="inline-flex items-start gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                    <Clock className="size-4" />
                  </span>
                  {workshop.business_hours}
                </li>
              )}
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => openForm()}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2a4fd6] px-5 font-semibold text-white hover:bg-[#2340ba]"
              >
                <CalendarClock className="size-4" />
                Pedir marcação de horário
              </button>
              {workshop.address_line && (
                <a
                  href={mapsUrl(workshop.address_line)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-5 font-semibold text-white hover:bg-white/10"
                >
                  <MapPin className="size-4" />
                  Abrir no Google Maps
                </a>
              )}
            </div>
          </div>

          {workshop.address_line ? (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <iframe
                title={`Mapa — ${name}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-72 w-full lg:h-full"
                src={`https://www.google.com/maps?q=${encodeURIComponent(workshop.address_line)}&output=embed`}
              />
            </div>
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
              <MapPin className="mb-2 size-8" />
              Endereço ainda não configurado. Fale com a gente pelos canais acima.
            </div>
          )}
        </div>
      </Section>

      <PublicFooter workshop={workshop} />

      <PublicRequestForm open={formOpen} onOpenChange={setFormOpen} defaultType={formType} />
    </div>
  );
}
