import { Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-gradient-to-b from-background to-muted/40 px-6 text-center">
      <div className="flex items-center gap-2 text-primary">
        <Truck className="size-8" />
        <span className="text-xl font-semibold text-foreground">DriverOps</span>
      </div>

      <div className="max-w-xl space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Gestão de frota, simples e moderna.
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Acesse o sistema para gerenciar sua operação em um só lugar.
        </p>
      </div>

      <Button size="lg" onClick={() => navigate("/login")}>
        Entrar
      </Button>
    </div>
  );
}
