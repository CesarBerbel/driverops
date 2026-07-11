import { apiClient } from "@/lib/api-client";
import { fetchPage, type Paginated } from "@/lib/pagination";

import type {
  Service,
  ServicePackage,
  ServicePackagePayload,
  ServicePayload,
  ServiceStatusFilter,
} from "./types";

export interface ListServicesParams {
  search?: string;
  status?: ServiceStatusFilter;
  category?: number;
}

export async function listServices(params: ListServicesParams = {}): Promise<Service[]> {
  const { data } = await apiClient.get<Service[]>("/services/", {
    params: {
      search: params.search || undefined,
      status: params.status,
      category: params.category,
    },
  });
  return data;
}

// Página real da listagem de serviços (envelope {count,next,previous,results}).
export function listServicesPage(
  page: number,
  params: ListServicesParams = {},
): Promise<Paginated<Service>> {
  return fetchPage<Service>("/services/", page, {
    search: params.search,
    status: params.status,
    category: params.category,
  });
}

export async function getService(id: number): Promise<Service> {
  const { data } = await apiClient.get<Service>(`/services/${id}/`);
  return data;
}

export async function createService(payload: Partial<ServicePayload>): Promise<Service> {
  const { data } = await apiClient.post<Service>("/services/", payload);
  return data;
}

export async function updateService(
  id: number,
  payload: Partial<ServicePayload>,
): Promise<Service> {
  const { data } = await apiClient.patch<Service>(`/services/${id}/`, payload);
  return data;
}

export async function deleteService(id: number): Promise<void> {
  await apiClient.delete(`/services/${id}/`);
}

export async function reactivateService(id: number): Promise<Service> {
  const { data } = await apiClient.post<Service>(`/services/${id}/reactivate/`);
  return data;
}

export interface ListPackagesParams {
  search?: string;
  status?: ServiceStatusFilter;
}

export async function listServicePackages(
  params: ListPackagesParams = {},
): Promise<ServicePackage[]> {
  const { data } = await apiClient.get<ServicePackage[]>("/service-packages/", {
    params: {
      search: params.search || undefined,
      status: params.status,
    },
  });
  return data;
}

// Página real da listagem de pacotes (envelope {count,next,previous,results}).
export function listServicePackagesPage(
  page: number,
  params: ListPackagesParams = {},
): Promise<Paginated<ServicePackage>> {
  return fetchPage<ServicePackage>("/service-packages/", page, {
    search: params.search,
    status: params.status,
  });
}

export async function getServicePackage(id: number): Promise<ServicePackage> {
  const { data } = await apiClient.get<ServicePackage>(`/service-packages/${id}/`);
  return data;
}

export async function createServicePackage(
  payload: Partial<ServicePackagePayload>,
): Promise<ServicePackage> {
  const { data } = await apiClient.post<ServicePackage>("/service-packages/", payload);
  return data;
}

export async function updateServicePackage(
  id: number,
  payload: Partial<ServicePackagePayload>,
): Promise<ServicePackage> {
  const { data } = await apiClient.patch<ServicePackage>(`/service-packages/${id}/`, payload);
  return data;
}

export async function deleteServicePackage(id: number): Promise<void> {
  await apiClient.delete(`/service-packages/${id}/`);
}

export async function reactivateServicePackage(id: number): Promise<ServicePackage> {
  const { data } = await apiClient.post<ServicePackage>(
    `/service-packages/${id}/reactivate/`,
  );
  return data;
}
