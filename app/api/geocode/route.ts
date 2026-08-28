import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const location = new URL(request.url).searchParams.get("location")?.trim();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!location) {
    return NextResponse.json(
      { error: "location is required" },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const query = new URLSearchParams({ address: location, key: apiKey });
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`,
      { cache: "no-store" }
    );
    const payload = await response.json();
    const result = Array.isArray(payload.results) ? payload.results[0] : undefined;

    if (!response.ok || payload.status !== "OK" || !result?.geometry?.location) {
      return NextResponse.json(
        {
          error:
            payload.error_message ||
            `Unable to find coordinates for this location (${payload.status || "unknown error"}).`,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      location: result.formatted_address || location,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach Google Geocoding." },
      { status: 502 }
    );
  }
}
