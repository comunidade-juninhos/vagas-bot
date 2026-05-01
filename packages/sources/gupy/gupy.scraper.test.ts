import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGupyJobs } from "./gupy.scraper.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchGupyJobs", () => {
  it("uses browser-like headers when requesting the Gupy API", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [
        {
          id: 123,
          name: "Backend Developer",
          publishedDate: "2026-05-01T12:00:00.000Z",
        },
      ],
      pagination: {
        total: 1,
        limit: 100,
        offset: 0,
      },
    }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    await fetchGupyJobs({ keywords: ["backend"], maxPagesPerKeyword: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "accept-language": expect.stringContaining("pt-BR"),
          origin: "https://portal.gupy.io",
          referer: "https://portal.gupy.io/",
          "user-agent": expect.stringMatching(/^Mozilla\/5\.0 .*Firefox\//),
        }),
      }),
    );
  });
});
