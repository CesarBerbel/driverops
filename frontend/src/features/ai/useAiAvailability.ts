import { useQuery } from "@tanstack/react-query";

import { usePermissionCheck } from "@/features/auth/usePermission";

import { getAIMetadata } from "./api";

/**
 * Disponibilidade da IA nos campos da OS: requer permissão ai.use e o módulo
 * ativo. O endpoint de metadados (acessível a ai.use) informa o estado do módulo
 * e as capacidades por campo, sem exigir a permissão de configuração (ai.view).
 */
export function useAiAvailability() {
  const can = usePermissionCheck();
  const canUse = can("ai.use");

  const metadataQuery = useQuery({
    queryKey: ["ai-metadata"],
    queryFn: getAIMetadata,
    enabled: canUse,
  });

  const enabled = canUse && Boolean(metadataQuery.data?.active);

  return {
    canUse,
    enabled,
    metadata: metadataQuery.data,
    isLoading: metadataQuery.isLoading,
  };
}
