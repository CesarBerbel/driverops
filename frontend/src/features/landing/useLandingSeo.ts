import { useEffect } from "react";

import type { PublicWorkshop } from "./types";

const DESCRIPTION =
  "Oficina mecânica com diagnóstico técnico, revisão preventiva, manutenção automotiva, orçamento transparente e atendimento com agendamento.";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

/**
 * Aplica title, meta description, Open Graph e JSON-LD (AutoRepair) da landing
 * usando os dados reais da oficina quando disponíveis, com fallback seguro.
 * Restaura o title anterior ao desmontar.
 */
export function useLandingSeo(workshop: PublicWorkshop | undefined) {
  useEffect(() => {
    const name = workshop?.trade_name || workshop?.legal_name || "Auto Mecânica";
    const title = `${name} — Oficina mecânica com diagnóstico e orçamento transparente`;
    const previousTitle = document.title;
    document.title = title;

    upsertMeta("name", "description", DESCRIPTION);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", DESCRIPTION);
    upsertMeta("property", "og:type", "website");
    if (workshop?.logo) upsertMeta("property", "og:image", workshop.logo);

    const ld = {
      "@context": "https://schema.org",
      "@type": "AutoRepair",
      name,
      description: DESCRIPTION,
      ...(workshop?.phone ? { telephone: workshop.phone } : {}),
      ...(workshop?.email ? { email: workshop.email } : {}),
      ...(workshop?.website ? { url: workshop.website } : {}),
      ...(workshop?.logo ? { image: workshop.logo } : {}),
      ...(workshop?.address_line
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: workshop.address_line,
              addressLocality: workshop.city || undefined,
              addressRegion: workshop.state || undefined,
              postalCode: workshop.zip_code || undefined,
            },
          }
        : {}),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      script.remove();
    };
  }, [workshop]);
}
