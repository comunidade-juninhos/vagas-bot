import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemotarJobs } from "./remotar.scraper.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchRemotarJobs", () => {
  it("uses browser-like headers when requesting the Remotar API", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      meta: {
        total: 1,
        per_page: 10,
        current_page: 1,
        last_page: 1,
      },
      data: [
        {
          id: 123,
          title: "Backend Developer",
          createdAt: "2026-05-01T12:00:00.000Z",
        },
      ],
    }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    await fetchRemotarJobs({ maxPages: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "accept-language": expect.stringContaining("pt-BR"),
          referer: "https://remotar.com.br/",
          "user-agent": expect.stringMatching(/^Mozilla\/5\.0 .*Firefox\//),
        }),
      }),
    );
  });
});
