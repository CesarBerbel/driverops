import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { formatCNPJ, formatPhone } from "@/lib/masks";

import { NAV_LINKS } from "../constants";
import { mailHref, mapsUrl, telHref, waLink } from "../contact";
import type { PublicWorkshop } from "../types";
import { BrandMark } from "./BrandMark";

interface PublicFooterProps {
  workshop: PublicWorkshop;
}

export function PublicFooter({ workshop }: PublicFooterProps) {
  const name = workshop.trade_name || workshop.legal_name || "Auto Mecânica";
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-black text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <BrandMark logo={workshop.logo} name={name} size="sm" />
          <p className="text-sm text-white/60">
            Diagnóstico técnico, manutenção automotiva e atendimento transparente, com
            acompanhamento claro da sua Ordem de Serviço.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Navegação</h3>
          <ul className="space-y-2 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Contato</h3>
          <ul className="space-y-2 text-sm">
            {workshop.phone && (
              <li>
                <a href={telHref(workshop.phone)} className="inline-flex items-center gap-2 hover:text-white">
                  <Phone className="size-4" /> {formatPhone(workshop.phone)}
                </a>
              </li>
            )}
            {workshop.whatsapp && (
              <li>
                <a
                  href={waLink(workshop.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle className="size-4" /> {formatPhone(workshop.whatsapp)}
                </a>
              </li>
            )}
            {workshop.email && (
              <li>
                <a href={mailHref(workshop.email)} className="inline-flex items-center gap-2 hover:text-white">
                  <Mail className="size-4" /> {workshop.email}
                </a>
              </li>
            )}
            {workshop.address_line && (
              <li>
                <a
                  href={mapsUrl(workshop.address_line)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-2 hover:text-white"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0" /> {workshop.address_line}
                </a>
              </li>
            )}
            {workshop.business_hours && (
              <li className="inline-flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" /> {workshop.business_hours}
              </li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Institucional</h3>
          <ul className="space-y-2 text-sm text-white/50">
            <li>Política de privacidade</li>
            <li>Termos de uso</li>
            {workshop.cnpj && <li>CNPJ: {formatCNPJ(workshop.cnpj)}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-white/40">
        © {year} {name}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
