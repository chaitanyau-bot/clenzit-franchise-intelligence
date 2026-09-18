import { NextRequest, NextResponse } from "next/server";

const CATEGORIES = [
  {
    key: "laundry",
    label: "Laundry & Dry Cleaning",
    query: "laundry dry cleaning",
  },
  {
    key: "carDealers",
    label: "Car Dealerships",
    query: "car dealerships",
  },
  {
    key: "premiumAuto",
    label: "Premium Car Dealerships",
    query: "luxury premium car dealerships",
  },
  {
    key: "showrooms",
    label: "Showrooms",
    query: "branded showrooms",
  },
  {
    key: "petShops",
    label: "Pet Shops & Pet Care",
    query: "pet shops pet care",
  },
  {
    key: "hotels",
    label: "Hotels",
    query: "hotels",
  },
  {
    key: "salons",
    label: "Salons & Beauty",
    query: "salons beauty parlours",
  },
  {
    key: "gyms",
    label: "Gyms & Fitness",
    query: "gyms fitness centres",
  },
  {
    key: "restaurants",
    label: "Restaurants & Cafes",
    query: "restaurants cafes",
  },
  {
    key: "hospitals",
    label: "Hospitals & Clinics",
    query: "hospitals clinics",
  },
  {
    key: "schools",
    label: "Schools & Colleges",
    query: "schools colleges",
  },
  {
    key: "offices",
    label: "Business & Corporate Offices",
    query: "business offices companies",
  },
  {
    key: "boutiques",
    label: "Boutiques & Fashion",
    query: "boutiques clothing fashion stores",
  },
  {
    key: "jewellery",
    label: "Jewellery Stores",
    query: "jewellery stores jewellers",
  },
  {
    key: "interiorDesign",
    label: "Interior Design & Furnishing",
    query: "interior designers home furnishing stores",
  },
  {
    key: "electronics",
    label: "Electronics & Mobile Retail",
    query: "electronics stores mobile phone stores",
  },
  {
    key: "travel",
    label: "Travel Agencies",
    query: "travel agencies tour operators",
  },
  {
    key: "realEstate",
    label: "Real Estate",
    query: "real estate offices property developers",
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const location = searchParams.get("location");

    const latitude = Number(searchParams.get("latitude"));
    const longitude = Number(searchParams.get("longitude"));

    const radius = Number(searchParams.get("radius") || "5000");

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // Validate API key
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GOOGLE_MAPS_API_KEY is not configured",
        },
        { status: 500 }
      );
    }

    // Validate request
    if (
      !location ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return NextResponse.json(
        {
          error: "location, latitude and longitude are required",
        },
        { status: 400 }
      );
    }

    // Keep radius within Google's supported range
    const safeRadius = Math.min(
      Math.max(radius, 100),
      50000
    );

    // Search all categories
    const results = await Promise.all(
      CATEGORIES.map(async (category) => {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:searchText",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.businessStatus,places.websiteUri",
            },

            body: JSON.stringify({
              textQuery: `${category.query} in ${location}`,

              pageSize: 20,

              locationBias: {
                circle: {
                  center: {
                    latitude,
                    longitude,
                  },
                  radius: safeRadius,
                },
              },
            }),
          }
        );

        const data = await response.json();

        // Google API error
        if (!response.ok) {
          return {
            key: category.key,
            label: category.label,
            count: 0,
            businesses: [],
            error:
              data?.error?.message ||
              "Google Places API error",
          };
        }

        // Format businesses
        const businesses = (data.places || []).map(
          (place: any) => ({
            id: place.id || null,

            name:
              place.displayName?.text ||
              "Unknown",

            address:
              place.formattedAddress ||
              "",

            latitude:
              place.location?.latitude ??
              null,

            longitude:
              place.location?.longitude ??
              null,

            types:
              place.types ||
              [],

            rating:
              place.rating ??
              null,

            reviews:
              place.userRatingCount ??
              0,

            businessStatus:
              place.businessStatus ||
              null,

            website:
              place.websiteUri ||
              null,
          })
        );

        // Fetch a small, low-rating sample of review excerpts only for laundry
        // profiles. Search results do not include review text; Place Details
        // does, and limiting this to six profiles keeps usage predictable.
        if (category.key === "laundry") {
          const reviewCandidates = businesses
            .filter((business: any) => business.id && typeof business.rating === "number" && business.rating < 4.5)
            .sort((a: any, b: any) => (a.rating ?? 5) - (b.rating ?? 5))
            .slice(0, 6);

          await Promise.all(
            reviewCandidates.map(async (business: any) => {
              try {
                const detailsResponse = await fetch(
                  `https://places.googleapis.com/v1/places/${encodeURIComponent(business.id)}`,
                  {
                    headers: {
                      "X-Goog-Api-Key": apiKey,
                      "X-Goog-FieldMask": "reviews",
                    },
                    cache: "no-store",
                  }
                );
                const details = await detailsResponse.json();
                if (detailsResponse.ok && Array.isArray(details.reviews)) {
                  business.reviewExcerpts = details.reviews
                    .filter((review: any) => review?.text?.text && typeof review.rating === "number" && review.rating <= 3)
                    .slice(0, 3)
                    .map((review: any) => ({
                      rating: review.rating ?? null,
                      text: review.text.text,
                      publishTime: review.publishTime ?? null,
                      author: review.authorAttribution?.displayName ?? null,
                    }));
                }
              } catch {
                // Review excerpts are supplementary; keep the profile usable.
              }
            })
          );
        }

        return {
          key: category.key,
          label: category.label,
          count: businesses.length,
          businesses,
        };
      })
    );

    // Return final response
    return NextResponse.json({
      success: true,
      location,
      latitude,
      longitude,
      radius: safeRadius,
      categories: results,
    });
  } catch (error) {
    console.error("Places API error:", error);

    return NextResponse.json(
      {
        error: "Failed to retrieve business information",
      },
      { status: 500 }
    );
  }
}
