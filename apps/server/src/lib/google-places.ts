import { env } from "@reel-to-food/env/server";

const PLACES_API_URL = "https://places.googleapis.com/v1/places";

// Never use "*": every extra field bumps the billing SKU
const DETAILS_FIELD_MASK = "id,displayName,formattedAddress,location,googleMapsUri";

// Google terms allow caching Places coordinates for at most 30 days
export const COORDS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type GooglePlaceDetails = {
  id: string;
  displayName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUri: string | null;
};

export type PlaceDetailsResult =
  | { status: "ok"; place: GooglePlaceDetails }
  | { status: "not_found" }
  | { status: "unavailable" };

type PlaceDetailsResponse = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
};

export function isGooglePlacesConfigured() {
  return Boolean(getApiKey());
}

function getApiKey() {
  const key: unknown = env.GOOGLE_PLACES_API_KEY;
  return typeof key === "string" && key.length > 0 ? key : null;
}

export function isCoordsStale(coordsCachedAt: Date | null, now = Date.now()) {
  return !coordsCachedAt || now - coordsCachedAt.getTime() > COORDS_TTL_MS;
}

// Place Details (New). Display fields are returned for rendering only and must
// not be persisted; only coordinates may be cached (see COORDS_TTL_MS)
export async function fetchPlaceDetails(googlePlaceId: string): Promise<PlaceDetailsResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { status: "unavailable" };
  }

  try {
    const response = await fetch(`${PLACES_API_URL}/${encodeURIComponent(googlePlaceId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    });

    if (response.status === 404) {
      return { status: "not_found" };
    }

    if (!response.ok) {
      console.error("Google Place Details failed", googlePlaceId, response.status);
      return { status: "unavailable" };
    }

    const data = (await response.json()) as PlaceDetailsResponse;

    return {
      status: "ok",
      place: {
        id: data.id,
        displayName: data.displayName?.text ?? null,
        formattedAddress: data.formattedAddress ?? null,
        latitude: data.location?.latitude ?? null,
        longitude: data.location?.longitude ?? null,
        googleMapsUri: data.googleMapsUri ?? null,
      },
    };
  } catch (error) {
    console.error("Google Place Details failed", googlePlaceId, error);
    return { status: "unavailable" };
  }
}
