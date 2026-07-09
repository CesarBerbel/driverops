import { CalendarClock, Menu, Phone } from "lucide-react";
import { useState } from "react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { NAV_LINKS } from "../constants";
import { waLink } from "../contact";
import type { PublicWorkshop } from "../types";
import { BrandMark } from "./BrandMark";

interface PublicHeaderProps {
  workshop: PublicWorkshop;
  onRequest: () => void;
}

export function PublicHeader({ workshop, onRequest }: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const name = workshop.trade_name || workshop.legal_name || "Auto Mecânica";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#inicio" aria-label={name} className="flex items-center">
          <BrandMark logo={workshop.logo} name={name} size="sm" eager />
        </a>

        <nav aria-label="Navegação principal" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {workshop.whatsapp && (
            <a
              href={waLink(workshop.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              <Phone className="size-4" />
              WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={onRequest}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2a4fd6] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2340ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8bff]"
          >
            <CalendarClock className="size-4" />
            Pedir marcação de horário
          </button>
        </div>

        {/* Menu mobile */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="inline-flex size-10 items-center justify-center rounded-md text-white md:hidden"
            >
              <Menu className="size-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-white/10 bg-[#0b0d12] text-white">
            <SheetHeader>
              <SheetTitle className="text-white">
                <BrandMark logo={workshop.logo} name={name} size="sm" />
              </SheetTitle>
            </SheetHeader>
            <nav aria-label="Navegação" className="mt-4 flex flex-col gap-1 px-4">
              {NAV_LINKS.map((link) => (
                <SheetClose asChild key={link.href}>
                  <a
                    href={link.href}
                    className="rounded-md px-3 py-2 text-base font-medium text-white/80 hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 px-4">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRequest();
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2a4fd6] px-4 font-semibold text-white"
              >
                <CalendarClock className="size-5" />
                Pedir marcação de horário
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
