import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

// Link de retorno ao site institucional. Presente em TODAS as telas públicas de
// consulta do veículo (formulário, link enviado, token expirado/inválido e área
// segura), sempre visível e fácil de tocar no mobile.
export function BackToSite({
  className = "",
  label = "Voltar para o site da oficina",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
