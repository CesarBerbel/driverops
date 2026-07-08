import { apiClient } from "@/lib/api-client";

import type {
  AIFieldInstruction,
  AIFieldInstructionPayload,
  AIGenerateRequest,
  AIMetadata,
  AISettings,
  AISettingsPayload,
  AISuggestion,
  AIUsageLog,
} from "./types";

export async function getAISettings(): Promise<AISettings> {
  const { data } = await apiClient.get<AISettings>("/ai/settings/");
  return data;
}

export async function updateAISettings(payload: AISettingsPayload): Promise<AISettings> {
  const { data } = await apiClient.patch<AISettings>("/ai/settings/", payload);
  return data;
}

export async function getAIMetadata(): Promise<AIMetadata> {
  const { data } = await apiClient.get<AIMetadata>("/ai/metadata/");
  return data;
}

export async function listAIFieldInstructions(): Promise<AIFieldInstruction[]> {
  const { data } = await apiClient.get<AIFieldInstruction[]>("/ai/field-instructions/");
  return data;
}

export async function updateAIFieldInstruction(
  id: number,
  payload: AIFieldInstructionPayload,
): Promise<AIFieldInstruction> {
  const { data } = await apiClient.patch<AIFieldInstruction>(
    `/ai/field-instructions/${id}/`,
    payload,
  );
  return data;
}

export async function restoreAIFieldInstruction(id: number): Promise<AIFieldInstruction> {
  const { data } = await apiClient.post<AIFieldInstruction>(
    `/ai/field-instructions/${id}/restore/`,
  );
  return data;
}

export async function restoreAllAIFieldInstructions(): Promise<AIFieldInstruction[]> {
  const { data } = await apiClient.post<AIFieldInstruction[]>(
    "/ai/field-instructions/restore-all/",
  );
  return data;
}

export async function generateAISuggestion(
  payload: AIGenerateRequest,
): Promise<AISuggestion> {
  const { data } = await apiClient.post<AISuggestion>("/ai/generate/", payload);
  return data;
}

export async function testAIPrompt(payload: AIGenerateRequest): Promise<AISuggestion> {
  const { data } = await apiClient.post<AISuggestion>("/ai/test/", payload);
  return data;
}

export async function listAIUsageLogs(): Promise<AIUsageLog[]> {
  const { data } = await apiClient.get<AIUsageLog[]>("/ai/logs/");
  return data;
}

export async function markAIUsageOutcome(id: number, applied: boolean): Promise<void> {
  await apiClient.post(`/ai/logs/${id}/outcome/`, { applied });
}
