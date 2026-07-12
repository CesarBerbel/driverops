import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({ apiClient: { get: vi.fn() } }));
import { apiClient } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, fetchPage } from "@/lib/pagination";

const envelope = { count: 1, next: null, previous: null, results: [{ id: 1 }] };

beforeEach(() => vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: envelope }));

describe("fetchPage", () => {
  it("sends page and page_size and returns the paginated envelope", async () => {
    const res = await fetchPage<{ id: number }>("/customers/", 2);
    expect(res).toEqual(envelope);
    expect(apiClient.get).toHaveBeenCalledWith("/customers/", {
      params: { page: 2, page_size: DEFAULT_PAGE_SIZE },
    });
  });

  it("drops empty/undefined/null params but keeps falsy-but-valid ones (0)", async () => {
    await fetchPage("/orders/", 1, {
      search: "gol",
      empty: "",
      missing: undefined,
      nothing: null,
      status: 0,
    });
    expect(apiClient.get).toHaveBeenCalledWith("/orders/", {
      params: { page: 1, page_size: DEFAULT_PAGE_SIZE, search: "gol", status: 0 },
    });
  });

  it("honors a custom pageSize and forwards extra axios config", async () => {
    await fetchPage("/parts/", 3, { q: "filtro" }, { pageSize: 50, signal: undefined });
    expect(apiClient.get).toHaveBeenCalledWith("/parts/", {
      params: { page: 3, page_size: 50, q: "filtro" },
      signal: undefined,
    });
  });
});
