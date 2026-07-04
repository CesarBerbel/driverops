import { Building2, ChevronRight, ClipboardList, Package, Tag, Wrench } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SETTINGS_CARDS = [
  {
    to: "/settings/workshop",
    icon: Building2,
    title: "Dados da Oficina",
    description: "Dados institucionais, contato e endereço usados nos documentos e PDFs.",
  },
  {
    to: "/settings/orders",
    icon: ClipboardList,
    title: "Configurações da OS",
    description: "Prazo padrão de entrega e termos padrão das Ordens de Serviço.",
  },
  {
    to: "/settings/categories",
    icon: Tag,
    title: "Categorias de Clientes",
    description: "Gerencie as categorias de clientes do sistema.",
  },
  {
    to: "/settings/categories/parts",
    icon: Package,
    title: "Categorias de Peças",
    description: "Gerencie as categorias de peças do sistema.",
  },
  {
    to: "/settings/categories/services",
    icon: Wrench,
    title: "Categorias de Serviços",
    description: "Gerencie as categorias de serviços do sistema.",
  },
] as const;

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Áreas administrativas e configuráveis do sistema.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CARDS.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {title}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
