import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const brand = params.get("brand")?.trim();
  const location = params.get("location")?.trim();
  const latitude = Number(params.get("latitude"));
  const longitude = Number(params.get("longitude"));
  const radius = Math.min(Math.max(Number(params.get("radius") || 5000), 100), 50000);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY is not configured" }, { status: 500 });
  if (!brand || !location || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "brand, location, latitude and longitude are required" }, { status: 400 });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus,places.websiteUri,places.googleMapsUri",
    },
    body: JSON.stringify({
      textQuery: `${brand} in ${location}`,
      pageSize: 20,
      locationBias: { circle: { center: { latitude, longitude }, radius } },
    }),
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || "Google Places API error" }, { status: response.status });

  const places = (data.places || []).map((place: any) => ({
    id: place.id || null,
    name: place.displayName?.text || "Unknown",
    address: place.formattedAddress || "",
    rating: place.rating ?? null,
    reviews: place.userRatingCount ?? 0,
    businessStatus: place.businessStatus || null,
    website: place.websiteUri || null,
    mapsUrl: place.googleMapsUri || null,
  }));
  return NextResponse.json({ success: true, brand, location, radius, count: places.length, places });
}
