/**
 * @fileoverview TVmaze API client for fetching show and episode data.
 *
 * Wraps the TVmaze public REST API. All functions return plain data objects
 * and throw on non-2xx responses or network failures — callers decide how
 * to handle errors.
 */

/** Base URL for all TVmaze API requests. */
const BASE_URL = "https://api.tvmaze.com";

/** An episode record as returned by the TVmaze API. */
export interface TvmazeEpisode {
  id: number;
  name: string;
  season: number;
  number: number;
  /** Air date in "YYYY-MM-DD" format. */
  airdate: string;
  /** Air time as an ISO 8601 timestamp with timezone offset. */
  airstamp: string;
  runtime: number | null;
}

/** A show record as returned by the TVmaze API, with embedded episode data. */
export interface TvmazeShow {
  id: number;
  name: string;
  status: "Running" | "Ended" | "To Be Determined" | "In Development";
  _embedded: {
    previousepisode?: TvmazeEpisode;
    nextepisode?: TvmazeEpisode;
  };
}

/**
 * Fetches a show from TVmaze including its most recent and next episodes.
 *
 * @param id - The TVmaze show ID.
 * @returns The show record with embedded episode data.
 * @throws {Error} If the response is not 2xx or the network request fails.
 */
export async function fetchShow(id: number): Promise<TvmazeShow> {
  const url = `${BASE_URL}/shows/${id}?embed[]=previousepisode&embed[]=nextepisode`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TVmaze API error ${response.status} for show ${id}`);
  }
  return response.json() as Promise<TvmazeShow>;
}
