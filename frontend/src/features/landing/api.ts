import { apiClient } from "@/lib/api-client";

import type { LandingData } from "./types";

export async function getLandingData(): Promise<LandingData> {
  const { data } = await apiClient.get<LandingData>("/public/landing/");
  return data;
}
