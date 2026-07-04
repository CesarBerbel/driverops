import { apiClient } from "@/lib/api-client";

import type { DashboardPeriod, DashboardStats } from "./types";

export async function getDashboardStats(
  period: DashboardPeriod,
): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>("/dashboard/stats/", {
    params: { period },
  });
  return data;
}
