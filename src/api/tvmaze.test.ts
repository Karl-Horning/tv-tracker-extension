/**
 * @fileoverview Unit tests for the TVmaze API client.
 *
 * Uses Vitest's vi.stubGlobal to mock the global fetch API, keeping tests
 * fast and deterministic without real network calls.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchShow } from "./tvmaze";
import type { TvmazeShow } from "./tvmaze";

const FIXTURE_SHOW: TvmazeShow = {
  id: 83,
  name: "The Simpsons",
  status: "Running",
  _embedded: {
    previousepisode: {
      id: 2764851,
      name: "Spring-Cleaning Frenzy",
      season: 37,
      number: 18,
      airdate: "2026-06-21",
      airstamp: "2026-06-22T00:00:00+00:00",
      runtime: 22,
    },
    nextepisode: {
      id: 2764852,
      name: "The Long Goodbye",
      season: 37,
      number: 19,
      airdate: "2026-07-05",
      airstamp: "2026-07-06T00:00:00+00:00",
      runtime: 22,
    },
  },
};

/**
 * Stubs global fetch with a mock that resolves to the given data and status.
 *
 * @param data - The value json() will resolve to.
 * @param status - HTTP status code (default 200).
 * @returns The mock function, for call assertions.
 */
function stubFetch(data: unknown, status = 200): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("fetchShow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed show data on success", async () => {
    stubFetch(FIXTURE_SHOW);
    const show = await fetchShow(83);
    expect(show.id).toBe(83);
    expect(show.name).toBe("The Simpsons");
    expect(show.status).toBe("Running");
    expect(show._embedded.previousepisode?.name).toBe("Spring-Cleaning Frenzy");
    expect(show._embedded.nextepisode?.name).toBe("The Long Goodbye");
  });

  it("requests the correct URL with both episode embeds", async () => {
    const mock = stubFetch(FIXTURE_SHOW);
    await fetchShow(83);
    expect(mock).toHaveBeenCalledWith(
      "https://api.tvmaze.com/shows/83?embed[]=previousepisode&embed[]=nextepisode",
    );
  });

  it("works when the show has no previous episode", async () => {
    const newShow: TvmazeShow = {
      ...FIXTURE_SHOW,
      _embedded: { nextepisode: FIXTURE_SHOW._embedded.nextepisode },
    };
    stubFetch(newShow);
    const show = await fetchShow(83);
    expect(show._embedded.previousepisode).toBeUndefined();
    expect(show._embedded.nextepisode).toBeDefined();
  });

  it("works when the show has no next episode", async () => {
    const endedShow: TvmazeShow = {
      ...FIXTURE_SHOW,
      status: "Ended",
      _embedded: { previousepisode: FIXTURE_SHOW._embedded.previousepisode },
    };
    stubFetch(endedShow);
    const show = await fetchShow(83);
    expect(show._embedded.nextepisode).toBeUndefined();
    expect(show.status).toBe("Ended");
  });

  it("throws with status and ID when the API returns 404", async () => {
    stubFetch({ message: "Not found" }, 404);
    await expect(fetchShow(99999)).rejects.toThrow(
      "TVmaze API error 404 for show 99999",
    );
  });

  it("throws with status and ID when the API returns 500", async () => {
    stubFetch({ message: "Server error" }, 500);
    await expect(fetchShow(83)).rejects.toThrow(
      "TVmaze API error 500 for show 83",
    );
  });

  it("propagates network failures unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));
    await expect(fetchShow(83)).rejects.toThrow("Network failure");
  });
});
