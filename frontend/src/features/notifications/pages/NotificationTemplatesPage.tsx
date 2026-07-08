import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { NotificationTemplatesManager } from "../components/NotificationTemplatesManager";

export function NotificationTemplatesPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/settings"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Configurações
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Templates de Notificação ao Cliente
        </h1>
        <p className="text-muted-foreground">
          Modelos profissionais e reutilizáveis para toda comunicação da oficina com o
          cliente. Edite o conteúdo, use variáveis dinâmicas, pré-visualize e envie testes.
        </p>
      </div>

      <NotificationTemplatesManager />
    </div>
  );
}
