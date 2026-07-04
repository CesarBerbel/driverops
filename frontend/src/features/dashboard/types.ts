export type DashboardPeriod = "today" | "week" | "month" | "last30" | "all";

export interface DashboardStats {
  period: string;
  customers_total: number;
  vehicles_total: number;
  suppliers_total: number;
  parts_total: number;
  parts_low_stock: number;
  services_total: number;
  packages_total: number;
  os_open: number;
  os_in_progress: number;
  os_finished_period: number;
  // DRF decimal strings.
  os_open_value: string;
  finished_value_period: string;
}
