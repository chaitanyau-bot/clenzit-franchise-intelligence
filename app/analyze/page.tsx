"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";

/* =========================================================
   TYPES
   ========================================================= */

type Business = {
  id?: string | null;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  types: string[];
  rating?: number | null;
  reviews?: number;
  businessStatus?: string | null;
  website?: string | null;
  reviewExcerpts?: Array<{
    rating?: number | null;
    text: string;
    publishTime?: string | null;
    author?: string | null;
  }>;
};

type PlaceCategory = {
  key: string;
  label: string;
  count: number;
  businesses: Business[];
  error?: string;
};

type PlacesResponse = {
  success: boolean;
  location: string;
  latitude: number;
  longitude: number;
  radius: number;
  categories: PlaceCategory[];
};

type BrandPresenceResponse = {
  success: boolean;
  brand: string;
  location: string;
  radius: number;
  count: number;
  places: Array<Pick<Business, "id" | "name" | "address" | "rating" | "reviews" | "businessStatus" | "website"> & { mapsUrl?: string | null }>;
  coverageNote?: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type AudienceSignal = {
  key: string;
  name: string;
  status: "live" | "needs_configuration" | "error";
  source: string;
  estimateLowerBound?: number;
  estimateUpperBound?: number;
  detail?: string;
  updatedAt?: string;
};

type AudienceDemographic = {
  ageRange: string;
  gender: string;
  status: "live" | "error";
  source: string;
  estimateLowerBound?: number;
  estimateUpperBound?: number;
  detail?: string;
};

type AudienceSignalsResponse = {
  success: boolean;
  mode: "live" | "needs_configuration";
  signals: AudienceSignal[];
  demographics: AudienceDemographic[];
};

type CityTier = "tier1" | "tier2" | "tier3";

type TerritoryModel = {
  tier: CityTier;
  tierLabel: string;

  minTerritoryHouseholds: number;
  maxTerritoryHouseholds: number;

  minEligibleHouseholds: number;
  maxEligibleHouseholds: number;

  estimatedTerritoryHouseholds: number;

  territoryFit: "STRONG" | "GOOD" | "REVIEW";

  householdCoveragePercent: number;
};

const TARGETING_SIGNAL_DEFINITIONS: AudienceSignal[] = [
  { key: "engagedShoppers", name: "Engaged Shoppers", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "luxuryGoods", name: "Luxury Goods", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "jewellery", name: "Jewellery", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "fashionApparel", name: "Fashion / Apparel", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "interiorDesign", name: "Interior Design", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "premiumAuto", name: "SUV / Premium Auto", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "premiumSmartphones", name: "Premium Smartphones", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "businessOwners", name: "Business Owners", status: "needs_configuration", source: "Meta Marketing API" },
  { key: "travel", name: "Travel", status: "needs_configuration", source: "Meta Marketing API" },
];

/* =========================================================
   CITY CLASSIFICATION
   ========================================================= */

/*
 * IMPORTANT
 *
 * This is intentionally configurable.
 *
 * Mumbai / major Tier 1:
 * 50,000–60,000 households
 *
 * Tier 2:
 * 60,000–120,000 households
 *
 * Tier 3:
 * We have NOT invented a final Clenzit territory
 * size yet. The temporary model below allows the
 * software to work until Clenzit defines it.
 */

const TIER_1_KEYWORDS = [
  "mumbai",
  "bombay",
  "delhi",
  "new delhi",
  "bengaluru",
  "bangalore",
  "hyderabad",
  "chennai",
  "pune",
  "kolkata",
  "ahmedabad",
];

const TIER_2_KEYWORDS = [
  "nashik",
  "nagpur",
  "aurangabad",
  "chhatrapati sambhajinagar",
  "thane",
  "vadodara",
  "surat",
  "rajkot",
  "indore",
  "bhopal",
  "jaipur",
  "lucknow",
  "kanpur",
  "coimbatore",
  "mysore",
  "mangalore",
  "visakhapatnam",
  "goa",
  "navi mumbai",
  "pimpri",
  "pimpri chinchwad",
];

/* =========================================================
   MAIN PAGE
   ========================================================= */

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-[#10264b]">
          <div className="text-center">
            <div className="text-lg font-semibold">
              Loading analysis...
            </div>
          </div>
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}

/* =========================================================
   ANALYZE CONTENT
   ========================================================= */

function AnalyzeContent() {
  const [location, setLocation] =
    useState("Loading location...");

  const [radiusKm, setRadiusKm] =
    useState(5);

  const [coordinates, setCoordinates] =
    useState<Coordinates | null>(null);

  const [placesData, setPlacesData] =
    useState<PlacesResponse | null>(null);

  const [placesLoading, setPlacesLoading] =
    useState(false);

  const [placesError, setPlacesError] =
    useState<string | null>(null);

  const [brandName, setBrandName] = useState("");
  const [brandPresence, setBrandPresence] = useState<BrandPresenceResponse | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  const [locationLoading, setLocationLoading] =
    useState(true);

  const [activeInsight, setActiveInsight] =
    useState<"overview" | "reviews" | "whitespace" | "brands">("overview");

  const searchBrandPresence = async () => {
    if (!brandName.trim() || !coordinates) return;
    setBrandLoading(true);
    setBrandError(null);
    try {
      const params = new URLSearchParams({
        brand: brandName.trim(), location,
        latitude: String(coordinates.latitude), longitude: String(coordinates.longitude),
        radius: String(radiusKm * 1000),
      });
      const response = await fetch(`/api/brand-presence?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to search Google Business Profiles");
      setBrandPresence(data);
    } catch (error) {
      setBrandError(error instanceof Error ? error.message : "Unable to search Google Business Profiles");
    } finally { setBrandLoading(false); }
  };

  /* =======================================================
     READ URL PARAMETERS
     ======================================================= */

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const locationParam =
      params.get("location");

    const radiusParam =
      params.get("radius");

    const latitudeParam =
      params.get("latitude");

    const longitudeParam =
      params.get("longitude");

    setLocation(
      locationParam || "Unknown Location"
    );

    const parsedRadius =
      Number(radiusParam);

    if (
      Number.isFinite(parsedRadius) &&
      parsedRadius > 0
    ) {
      setRadiusKm(Math.min(Math.max(parsedRadius, 1), 15));
    } else {
      setRadiusKm(5);
    }

    // Number(null) evaluates to 0. Treat missing URL coordinates as missing so
    // that the location is geocoded instead of silently querying Meta at 0,0.
    const parsedLatitude =
      latitudeParam === null ? Number.NaN : Number(latitudeParam);

    const parsedLongitude =
      longitudeParam === null ? Number.NaN : Number(longitudeParam);

    if (
      Number.isFinite(parsedLatitude) &&
      Number.isFinite(parsedLongitude) &&
      parsedLatitude >= -90 &&
      parsedLatitude <= 90 &&
      parsedLongitude >= -180 &&
      parsedLongitude <= 180
    ) {
      setCoordinates({
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      });

      setLocationLoading(false);
    } else if (!locationParam) {
      setLocationLoading(false);
    }
  }, []);

  /* =======================================================
     GEOCODE LOCATION
     ======================================================= */

  useEffect(() => {
    if (
      location === "Loading location..." ||
      location === "Unknown Location"
    ) {
      return;
    }

    if (coordinates) {
      setLocationLoading(false);
      return;
    }

    const geocodeLocation = async () => {
      try {
        setLocationLoading(true);
        setPlacesError(null);

        const params = new URLSearchParams({
          location,
        });

        const response = await fetch(
          `/api/geocode?${params.toString()}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to determine location coordinates"
          );
        }

        const latitudeCandidates = [
          data?.latitude,
          data?.lat,
          data?.location?.latitude,
          data?.location?.lat,
          data?.coordinates?.latitude,
          data?.coordinates?.lat,
        ];

        const longitudeCandidates = [
          data?.longitude,
          data?.lng,
          data?.location?.longitude,
          data?.location?.lng,
          data?.coordinates?.longitude,
          data?.coordinates?.lng,
        ];

        const latitude =
          latitudeCandidates
            .map(Number)
            .find(Number.isFinite);

        const longitude =
          longitudeCandidates
            .map(Number)
            .find(Number.isFinite);

        if (
          latitude === undefined ||
          longitude === undefined
        ) {
          throw new Error(
            "Unable to determine location coordinates"
          );
        }

        setCoordinates({
          latitude,
          longitude,
        });
      } catch (error) {
        console.error(
          "Geocoding error:",
          error
        );

        setPlacesError(
          error instanceof Error
            ? error.message
            : "Unable to determine location coordinates"
        );
      } finally {
        setLocationLoading(false);
      }
    };

    geocodeLocation();
  }, [location, coordinates]);

  /* =======================================================
     FETCH GOOGLE PLACES
     ======================================================= */

  useEffect(() => {
    if (!coordinates) {
      return;
    }

    if (
      location === "Loading location..." ||
      location === "Unknown Location"
    ) {
      return;
    }

    const fetchPlaces = async () => {
      try {
        setPlacesLoading(true);
        setPlacesError(null);

        const radiusMeters = Math.min(
          Math.max(radiusKm * 1000, 100),
          50000
        );

        const params = new URLSearchParams({
          location,
          latitude:
            String(coordinates.latitude),
          longitude:
            String(coordinates.longitude),
          radius:
            String(radiusMeters),
        });

        const response = await fetch(
          `/api/places?${params.toString()}`
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Failed to load local businesses"
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              "Places data could not be loaded"
          );
        }

        const categories: PlaceCategory[] =
          Array.isArray(data.categories)
            ? data.categories.map(
                (
                  category: any,
                  index: number
                ) => {
                  const businesses =
                    Array.isArray(
                      category?.businesses
                    )
                      ? category.businesses
                      : [];

                  return {
                    key:
                      category?.key ||
                      `category-${index}`,

                    label:
                      category?.label ||
                      `Category ${index + 1}`,

                    count:
                      typeof category?.count ===
                      "number"
                        ? category.count
                        : businesses.length,

                    businesses,

                    error:
                      category?.error ||
                      undefined,
                  };
                }
              )
            : [];

        setPlacesData({
          success: true,

          location:
            data.location || location,

          latitude:
            Number(data.latitude) ||
            coordinates.latitude,

          longitude:
            Number(data.longitude) ||
            coordinates.longitude,

          radius:
            Number(data.radius) ||
            radiusMeters,

          categories,
        });
      } catch (error) {
        console.error(
          "Places API error:",
          error
        );

        setPlacesError(
          error instanceof Error
            ? error.message
            : "Unable to load local business data"
        );

        setPlacesData(null);
      } finally {
        setPlacesLoading(false);
      }
    };

    fetchPlaces();
  }, [
    coordinates,
    location,
    radiusKm,
  ]);

  /* =======================================================
     TERRITORY MODEL
     ======================================================= */

  const territoryModel =
    useMemo<TerritoryModel>(() => {

      const tier =
        classifyCity(location);

      /*
       * Mumbai / Tier 1
       */

      if (tier === "tier1") {
        return buildTerritoryModel({
          tier: "tier1",
          tierLabel: "Mumbai / Tier 1",
          minTerritoryHouseholds: 50000,
          maxTerritoryHouseholds: 60000,
          minEligibleHouseholds: 10000,
          maxEligibleHouseholds: 12000,
          radiusKm,
        });
      }

      /*
       * Tier 2
       */

      if (tier === "tier2") {
        return buildTerritoryModel({
          tier: "tier2",
          tierLabel: "Tier 2 City",
          minTerritoryHouseholds: 60000,
          maxTerritoryHouseholds: 120000,
          minEligibleHouseholds: 10000,
          maxEligibleHouseholds: 12000,
          radiusKm,
        });
      }

      /*
       * Tier 3
       *
       * Temporary configurable model.
       *
       * We are NOT claiming this is the final
       * Clenzit Tier 3 rule.
       */

      return buildTerritoryModel({
        tier: "tier3",
        tierLabel: "Tier 3 City",
        minTerritoryHouseholds: 40000,
        maxTerritoryHouseholds: 80000,
        minEligibleHouseholds: 10000,
        maxEligibleHouseholds: 12000,
        radiusKm,
      });

    }, [location, radiusKm]);

  /* =======================================================
     DYNAMIC ANALYSIS
     ======================================================= */

  const analysis = useMemo(() => {

    const categories =
      placesData?.categories || [];

    const getCount = (
      key: string
    ) => {
      const category =
        categories.find(
          (item) =>
            item.key === key
        );

      return category?.count || 0;
    };

    /* -----------------------------------------------------
       CATEGORY COUNTS
       ----------------------------------------------------- */

    const laundry =
      getCount("laundry");

    const carDealers =
      getCount("carDealers");

    const premiumAuto =
      getCount("premiumAuto");

    const showrooms =
      getCount("showrooms");

    const petShops =
      getCount("petShops");

    const hotels =
      getCount("hotels");

    const salons =
      getCount("salons");

    const gyms =
      getCount("gyms");

    const restaurants =
      getCount("restaurants");

    const hospitals =
      getCount("hospitals");

    const schools =
      getCount("schools");

    const offices =
      getCount("offices");

    const boutiques =
      getCount("boutiques");

    const realEstate =
      getCount("realEstate");

    const jewelleryStores =
      getCount("jewellery");

    const interiorDesignStores =
      getCount("interiorDesign");

    const electronicsStores =
      getCount("electronics");

    const travelBusinesses =
      getCount("travel");

    const totalBusinesses =
      categories.reduce(
        (sum, category) =>
          sum +
          Math.max(
            0,
            category.count || 0
          ),
        0
      );

    /* -----------------------------------------------------
       BUSINESS ACTIVITY
       ----------------------------------------------------- */

    const commercialActivity =
      clamp(
        Math.round(
          restaurants * 0.20 +
          hotels * 0.90 +
          salons * 0.70 +
          gyms * 0.50 +
          offices * 0.90 +
          hospitals * 0.80 +
          schools * 0.40 +
          realEstate * 0.50
        ),
        10,
        95
      );

    /* -----------------------------------------------------
       PREMIUM CUSTOMER SIGNAL
       ----------------------------------------------------- */

    const premiumCustomerSignal =
      clamp(
        Math.round(
          25 +
          premiumAuto * 1.8 +
          showrooms * 0.8 +
          boutiques * 1.1 +
          hotels * 0.8 +
          salons * 0.5 +
          gyms * 0.4
        ),
        15,
        95
      );

    /* -----------------------------------------------------
       BUSINESS OWNER / CORPORATE SIGNAL
       ----------------------------------------------------- */

    const businessOwnerSignal =
      clamp(
        Math.round(
          20 +
          offices * 1.1 +
          realEstate * 0.7 +
          carDealers * 0.3
        ),
        10,
        95
      );

    /* -----------------------------------------------------
       DIGITAL PROXY SIGNALS
       ----------------------------------------------------- */

    const engagedShoppers =
      clamp(
        Math.round(
          25 +
          restaurants * 0.9 +
          boutiques * 1.2 +
          salons * 0.6 +
          gyms * 0.4
        ),
        10,
        95
      );

    const luxuryGoods =
      clamp(
        Math.round(
          20 +
          premiumAuto * 1.4 +
          boutiques * 0.8 +
          hotels * 0.7 +
          showrooms * 0.5
        ),
        10,
        95
      );

    const jewellery =
      clamp(
        Math.round(
          25 +
          boutiques * 0.8 +
          premiumAuto * 0.5 +
          showrooms * 0.5
        ),
        10,
        95
      );

    const fashion =
      clamp(
        Math.round(
          25 +
          boutiques * 1.4 +
          salons * 0.5
        ),
        10,
        95
      );

    const interiorDesign =
      clamp(
        Math.round(
          20 +
          realEstate * 1.1 +
          showrooms * 0.7 +
          offices * 0.3
        ),
        10,
        95
      );

    const suvPremiumAuto =
      clamp(
        Math.round(
          20 +
          premiumAuto * 1.8 +
          carDealers * 0.5
        ),
        10,
        95
      );

    const premiumSmartphones =
      clamp(
        Math.round(
          25 +
          offices * 0.6 +
          premiumAuto * 0.5 +
          showrooms * 0.4
        ),
        10,
        95
      );

    const travel =
      clamp(
        Math.round(
          20 +
          hotels * 1.3 +
          restaurants * 0.2 +
          premiumAuto * 0.4
        ),
        10,
        95
      );

    const digitalSignals = [
      {
        name: "Engaged Shoppers",
        score: engagedShoppers,
      },
      {
        name: "Luxury Goods",
        score: luxuryGoods,
      },
      {
        name: "Jewellery",
        score: jewellery,
      },
      {
        name: "Fashion / Apparel",
        score: fashion,
      },
      {
        name: "Interior Design",
        score: interiorDesign,
      },
      {
        name: "SUV / Premium Auto",
        score: suvPremiumAuto,
      },
      {
        name: "Premium Smartphones",
        score: premiumSmartphones,
      },
      {
        name: "Business Owners",
        score: businessOwnerSignal,
      },
      {
        name: "Travel",
        score: travel,
      },
    ];

    const digitalAverage =
      Math.round(
        digitalSignals.reduce(
          (sum, signal) =>
            sum + signal.score,
          0
        ) /
          digitalSignals.length
      );

    const digitalDemand =
      digitalAverage >= 70
        ? "HIGH"
        : digitalAverage >= 50
        ? "MODERATE"
        : "LOW";

    /* -----------------------------------------------------
       DIRECT LAUNDRY COMPETITION

       IMPORTANT:
       Google currently returns up to 20 results
       in our existing route.

       Therefore we treat 20 as "20+ identified"
       rather than exactly 20.
       ----------------------------------------------------- */

    const laundryIsCapped =
      laundry >= 20;

    const effectiveLaundry =
      laundryIsCapped
        ? 20
        : laundry;

    const competitionPressure =
      clamp(
        Math.round(
          effectiveLaundry * 3.5
        ),
        0,
        100
      );

    /*
     * Competition should NOT destroy the opportunity.
     *
     * We use it as one factor among several.
     */

    const competition =
      competitionPressure >= 70
        ? "HIGH"
        : competitionPressure >= 40
        ? "MODERATE"
        : competitionPressure >= 20
        ? "LOW–MOD"
        : "LOW";

    /* -----------------------------------------------------
       TERRITORY FIT
       ----------------------------------------------------- */

    const territoryFitScore =
      territoryModel.territoryFit ===
      "STRONG"
        ? 95
        : territoryModel.territoryFit ===
          "GOOD"
        ? 75
        : 50;

    /* -----------------------------------------------------
       OVERALL INTERNAL SCORE
       ----------------------------------------------------- */

    const internalScore =
      clamp(
        Math.round(
          territoryFitScore * 0.35 +
          premiumCustomerSignal * 0.15 +
          commercialActivity * 0.15 +
          digitalAverage * 0.10 +
          businessOwnerSignal * 0.10 +
          (
            100 -
            competitionPressure
          ) * 0.15
        ),
        20,
        95
      );

    /*
     * CUSTOMER-FACING RECOMMENDATION
     *
     * We intentionally do NOT expose internalScore.
     */

    let recommendation =
      "LOCATION REQUIRES FURTHER REVIEW";

    let recommendationTitle =
      "Further Location Validation Required";

    if (
      territoryModel.territoryFit ===
        "STRONG" &&
      internalScore >= 60
    ) {
      recommendation =
        "HIGH POTENTIAL";

      recommendationTitle =
        "Strong Franchise Opportunity";
    } else if (
      territoryModel.territoryFit !==
        "REVIEW" &&
      internalScore >= 50
    ) {
      recommendation =
        "GOOD OPPORTUNITY";

      recommendationTitle =
        "Good Franchise Opportunity";
    } else if (
      internalScore >= 40
    ) {
      recommendation =
        "PROMISING OPPORTUNITY";

      recommendationTitle =
        "Promising Franchise Opportunity";
    }

    /* -----------------------------------------------------
       CUSTOMER SIGNALS
       ----------------------------------------------------- */

    const customerSignals = [
      {
        name: "Shopping Intent",
        score: engagedShoppers,
      },
      {
        name: "Premium Lifestyle",
        score: premiumCustomerSignal,
      },
      {
        name: "Fashion Potential",
        score: fashion,
      },
      {
        name: "Business Potential",
        score: businessOwnerSignal,
      },
    ];

    const targetingContext: Record<string, string> = {
      engagedShoppers: `Google Places live context: ${boutiques + showrooms + restaurants} retail, showroom and food-service establishments identified.`,
      luxuryGoods: `Google Places live context: ${premiumAuto + showrooms + boutiques} premium-auto, showroom and boutique establishments identified.`,
      jewellery: `Google Places live context: ${jewelleryStores} jewellery establishments identified.`,
      fashionApparel: `Google Places live context: ${boutiques} fashion and boutique establishments identified.`,
      interiorDesign: `Google Places live context: ${interiorDesignStores} interior-design and furnishing establishments identified.`,
      premiumAuto: `Google Places live context: ${premiumAuto} premium-auto establishments identified.`,
      premiumSmartphones: `Google Places live context: ${electronicsStores} electronics and mobile retailers identified. This is not a measure of premium-smartphone ownership.`,
      businessOwners: `Google Places live context: ${offices + realEstate} offices and real-estate businesses identified. This is not a count of business owners.`,
      travel: `Google Places live context: ${hotels + travelBusinesses} hotels and travel businesses identified. This is not a travel-audience estimate.`,
    };

    /* -----------------------------------------------------
       COMMERCIAL OPPORTUNITY
       ----------------------------------------------------- */

    const commercialOpportunity =
      hotels +
      salons +
      gyms +
      restaurants +
      offices +
      hospitals;

    /* -----------------------------------------------------
       POSITIVE OPPORTUNITY HIGHLIGHTS
       ----------------------------------------------------- */

    const highlights: string[] = [];

    if (
      territoryModel.territoryFit ===
      "STRONG"
    ) {
      highlights.push(
        `Territory household framework aligns with the ${territoryModel.tierLabel} Clenzit model.`
      );
    } else {
      highlights.push(
        `The location is being evaluated against the ${territoryModel.tierLabel} territory framework.`
      );
    }

    if (
      territoryModel.minEligibleHouseholds >=
      10000
    ) {
      highlights.push(
        `Clenzit targets approximately 10,000–12,000 eligible households within a qualified territory.`
      );
    }

    if (
      premiumCustomerSignal >= 65
    ) {
      highlights.push(
        "Strong premium customer indicators are visible in the selected catchment."
      );
    }

    if (
      commercialActivity >= 65
    ) {
      highlights.push(
        "The catchment demonstrates strong commercial activity suitable for additional B2B opportunities."
      );
    }

    if (
      digitalAverage >= 65
    ) {
      highlights.push(
        "Customer and lifestyle signals indicate encouraging digital demand potential."
      );
    }

    if (
      laundry > 0
    ) {
      highlights.push(
        laundryIsCapped
          ? "Multiple laundry and dry-cleaning providers are already active in the market, indicating an established service category."
          : "Existing laundry and dry-cleaning activity confirms an established local service category."
      );
    }

    return {
      totalBusinesses,

      laundry,
      laundryIsCapped,

      carDealers,
      premiumAuto,
      showrooms,
      petShops,
      hotels,
      salons,
      gyms,
      restaurants,
      hospitals,
      schools,
      offices,
      boutiques,
      realEstate,
      jewelleryStores,
      interiorDesignStores,
      electronicsStores,
      travelBusinesses,

      commercialActivity,
      commercialOpportunity,

      premiumCustomerSignal,
      businessOwnerSignal,

      digitalSignals,
      digitalAverage,
      digitalDemand,

      competition,
      competitionPressure,

      internalScore,

      recommendation,
      recommendationTitle,

      customerSignals,

      targetingContext,

      highlights,
    };
  }, [
    placesData,
    territoryModel,
  ]);

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#10264b]">

      {/* =================================================
          HEADER
          ================================================= */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>

            <div className="flex items-center gap-2">

              <h1 className="text-2xl font-black tracking-[0.18em]">
                CLENZIT
              </h1>

              <span className="text-xl text-[#d6a13b]">
                ✦
              </span>

            </div>

            <p className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-slate-500">
              FRANCHISE INTELLIGENCE
            </p>

          </div>

          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            ← Dashboard
          </Link>

        </div>

      </header>

      {/* =================================================
          MAIN
          ================================================= */}

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* LOCATION */}

        <section className="mb-8">

          <p className="text-sm font-bold uppercase tracking-widest text-[#c4912e]">
            Area Analysis
          </p>

          <div className="mt-2 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

            <div>

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {formatLocation(location)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {radiusKm} km serviceable catchment ·{" "}
                {territoryModel.tierLabel}
              </p>

            </div>

            <button
              type="button"
              className="w-fit rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
            >
              Export Report
            </button>

          </div>

        </section>

        {/* =================================================
            INNOVATION TABS
            ================================================= */}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {[
              ["overview", "Overview"],
              ["reviews", "Reviews & Opportunity"],
              ["whitespace", "White-space Map"],
              ["brands", "Brand Footprint"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveInsight(key as typeof activeInsight)}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
                  activeInsight === key
                    ? "bg-[#10264b] text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeInsight === "reviews" && (
            <div className="mt-3 rounded-xl bg-amber-50 p-5">
              <h3 className="font-bold text-[#10264b]">Service gaps and review opportunity</h3>
              <p className="mt-1 text-sm text-amber-900">
                Only Google-returned review excerpts rated 3 stars or below are shown as negative-review opportunities. The panel never invents review comments.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {((placesData?.categories || []).find((c) => c.key === "laundry")?.businesses || [])
                  .filter((b) =>
                    typeof b.rating === "number" &&
                    b.rating < 4.5 &&
                    (b.reviewExcerpts?.length || 0) > 0
                  )
                  .slice(0, 6)
                  .map((b, i) => (
                    <div key={`${b.name}-${i}`} className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
                      <p className="font-semibold text-[#10264b]">{b.name}</p>
                      <p className="mt-1 text-amber-800">★ {Number(b.rating).toFixed(1)} · {(b.reviews || 0).toLocaleString()} reviews</p>
                      {b.reviewExcerpts?.filter((review) => typeof review.rating === "number" && review.rating <= 3).slice(0, 2).map((review, reviewIndex) => (
                        <blockquote key={`${b.name}-review-${reviewIndex}`} className="mt-3 border-l-2 border-amber-300 pl-3 text-slate-600">
                          “{review.text}”
                          {review.author ? <cite className="mt-1 block text-xs not-italic text-slate-400">— {review.author}</cite> : null}
                        </blockquote>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeInsight === "whitespace" && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-5">
              <h3 className="font-bold text-[#10264b]">White-space opportunity</h3>
              <p className="mt-1 text-sm text-emerald-900">
                The map view highlights demand indicators against laundry competition inside the selected radius. It is an opportunity signal, not a territorial guarantee.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InsightMetric label="Laundry competition" value={analysis.laundryIsCapped ? "20+" : String(analysis.laundry)} />
                <InsightMetric label="Commercial activity" value={`${analysis.commercialActivity}/100`} />
                <InsightMetric label="Digital opportunity" value={`${analysis.digitalAverage}/100`} />
              </div>
            </div>
          )}

          {activeInsight === "brands" && (
            <div className="mt-3 rounded-xl bg-slate-50 p-5">
              <h3 className="font-bold text-[#10264b]">Competitive brand presence</h3>
              <p className="mt-1 text-sm text-slate-600">Search a brand to compare its claimed presence with Google Business Profiles found in this catchment. Results are Google-returned listings, not a guarantee of every physical store.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input value={brandName} onChange={(event) => setBrandName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchBrandPresence(); }} placeholder="e.g. Tumbledry, UClean, Raymond" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#10264b]" />
                <button type="button" onClick={searchBrandPresence} disabled={brandLoading || !coordinates || !brandName.trim()} className="rounded-lg bg-[#10264b] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{brandLoading ? "Searching…" : "Check local presence"}</button>
              </div>
              {brandError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{brandError}</p>}
              {brandPresence && <div className="mt-4 rounded-lg border border-[#e4c477] bg-[#fff9e9] p-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-[#a97918]">Unique Google listings found</p><p className="mt-1 text-3xl font-bold text-[#10264b]">{brandPresence.count}</p></div><p className="text-sm text-slate-600">within {radiusKm} km of {formatLocation(location)}</p></div><p className="mt-2 text-xs text-slate-500">{brandPresence.coverageNote}</p><div className="mt-4 grid gap-3 md:grid-cols-2">{brandPresence.places.map((place) => <div key={place.id || `${place.name}-${place.address}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm"><p className="font-bold text-[#10264b]">{place.name}</p><p className="mt-1 text-slate-600">{place.address}</p><p className="mt-1 text-amber-700">{place.rating ? `★ ${place.rating.toFixed(1)}` : "No rating"} · {place.reviews?.toLocaleString() || 0} reviews</p>{place.mapsUrl && <a href={place.mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-[#10264b] underline">Open in Google Maps</a>}</div>)}</div>{brandPresence.count === 0 && <p className="mt-3 text-sm text-slate-600">No matching Google Business Profiles were returned for this area.</p>}</div>}
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {((placesData?.categories || []).find((c) => c.key === "laundry")?.businesses || []).slice(0, 12).map((b, i) => (
                  <div key={`${b.name}-${i}`} className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-[#10264b]">{b.name}</div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* =================================================
            TERRITORY OPPORTUNITY
            ================================================= */}

        <section className="mb-6 rounded-2xl border border-[#e4c477] bg-[#fff9e9] p-7">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a97918]">
                CLENZIT TERRITORY MODEL
              </p>

              <h3 className="mt-2 text-2xl font-bold">
                {territoryModel.tierLabel}
              </h3>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#765b20]">
                Clenzit evaluates each proposed franchise
                territory against a defined household
                opportunity framework. Individual society
                names and individual commercial establishments
                are intentionally not displayed.
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

              <TerritoryMetric
                title="Target Territory"
                value={`${formatCompact(
                  territoryModel.minTerritoryHouseholds
                )}–${formatCompact(
                  territoryModel.maxTerritoryHouseholds
                )}`}
                subtitle="households"
              />

              <TerritoryMetric
                title="Eligible Households"
                value={`${formatCompact(
                  territoryModel.minEligibleHouseholds
                )}–${formatCompact(
                  territoryModel.maxEligibleHouseholds
                )}`}
                subtitle="Clenzit target"
              />

              <TerritoryMetric
                title="Territory Fit"
                value={
                  territoryModel.territoryFit
                }
                subtitle="initial assessment"
              />

            </div>

          </div>

        </section>

        {/* =================================================
            SCORE + SNAPSHOT
            ================================================= */}

        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">

          {/* CUSTOMER-FACING RECOMMENDATION */}

          <div className="rounded-2xl bg-[#10264b] p-7 text-white shadow-sm">

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e0b65b]">
              Clenzit Opportunity
            </p>

            <h3 className="mt-6 text-3xl font-black leading-tight">
              {analysis.recommendation}
            </h3>

            <div className="mt-5 inline-flex rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300">
              {analysis.recommendationTitle}
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-300">
              The selected location is being evaluated
              against Clenzit's territory framework,
              local commercial activity, customer signals
              and competitive landscape.
            </p>

          </div>

          {/* MARKET SNAPSHOT */}

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

            <h3 className="text-xl font-bold">
              Market Snapshot
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Key indicators for the selected service territory.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <Snapshot
                title="Target Territory"
                value={`${formatCompact(
                  territoryModel.minTerritoryHouseholds
                )}–${formatCompact(
                  territoryModel.maxTerritoryHouseholds
                )}`}
                subtitle="households"
              />

              <Snapshot
                title="Eligible Households"
                value={`${formatCompact(
                  territoryModel.minEligibleHouseholds
                )}–${formatCompact(
                  territoryModel.maxEligibleHouseholds
                )}`}
                subtitle="Clenzit target"
              />

              <Snapshot
                title="Digital Demand"
                value={analysis.digitalDemand}
                subtitle={`${analysis.digitalAverage}/100 proxy`}
              />

              <Snapshot
                title="Commercial Activity"
                value={`${analysis.commercialActivity}/100`}
                subtitle="local business signal"
              />

            </div>

          </div>

        </section>

        {/* =================================================
            MARKET INTELLIGENCE
            ================================================= */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

          <SectionTitle
            eyebrow="01 · TERRITORY INTELLIGENCE"
            title="Location fundamentals"
            description="Key indicators used to evaluate the proposed Clenzit territory."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <InfoCard
              title="Target Territory"
              value={`${formatCompact(
                territoryModel.minTerritoryHouseholds
              )}–${formatCompact(
                territoryModel.maxTerritoryHouseholds
              )}`}
              subtitle="households"
            />

            <InfoCard
              title="Eligible Household Target"
              value={`${formatCompact(
                territoryModel.minEligibleHouseholds
              )}–${formatCompact(
                territoryModel.maxEligibleHouseholds
              )}`}
              subtitle="Clenzit opportunity"
            />

            <InfoCard
              title="Digital Opportunity"
              value={
                analysis.digitalAverage >= 65
                  ? "High"
                  : analysis.digitalAverage >=
                    50
                  ? "Moderate"
                  : "Developing"
              }
              subtitle="local customer proxy"
            />

            <InfoCard
              title="Territory Fit"
              value={
                territoryModel.territoryFit
              }
              subtitle="initial assessment"
            />

          </div>

        </section>

        {/* =================================================
            POSITIVE OPPORTUNITY HIGHLIGHTS
            ================================================= */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

          <SectionTitle
            eyebrow="02 · OPPORTUNITY HIGHLIGHTS"
            title="Why this location is interesting for Clenzit"
            description="Positive market indicators identified within the selected catchment."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            {analysis.highlights.map(
              (highlight, index) => (

                <div
                  key={index}
                  className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-5"
                >

                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    ✓
                  </div>

                  <p className="text-sm leading-6 text-emerald-900">
                    {highlight}
                  </p>

                </div>

              )
            )}

          </div>

        </section>

        {/* =================================================
            LOCAL BUSINESS LANDSCAPE
            ================================================= */}

        <section className="mt-6 rounded-2xl border border-black/10 bg-white p-6">

          <SectionTitle
            eyebrow="03 · LOCAL BUSINESS LANDSCAPE"
            title="Businesses & Establishments"
            description="Live local business intelligence around the selected franchise location."
          />

          {locationLoading && (
            <div className="mt-6 rounded-xl border border-black/10 bg-slate-50 p-5 text-sm text-neutral-500">
              Determining location coordinates...
            </div>
          )}

          {!locationLoading &&
            placesLoading && (
              <div className="mt-6 rounded-xl border border-black/10 bg-slate-50 p-5 text-sm text-neutral-500">
                Loading local businesses...
              </div>
            )}

          {placesError && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {placesError}
            </div>
          )}

          {!locationLoading &&
            !placesLoading &&
            !placesError &&
            placesData && (

              <div className="mt-6 grid gap-4 md:grid-cols-2">

                {placesData.categories.map(
                  (category) => {

                    const businessList =
                      Array.isArray(
                        category.businesses
                      )
                        ? category.businesses
                        : [];

                    const displayCount =
                      businessList.length >= 20
                        ? "20+"
                        : String(
                            businessList.length
                          );

                    return (

                      <div
                        key={category.key}
                        className="rounded-xl border border-black/10 bg-neutral-50 p-5"
                      >

                        <div className="flex items-center justify-between gap-4">

                          <h3 className="text-base font-semibold text-[#10264b]">
                            {category.label}
                          </h3>

                          <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                            {displayCount}
                          </span>

                        </div>

                        {category.error && (
                          <p className="mt-4 text-sm text-red-600">
                            {category.error}
                          </p>
                        )}

                        {!category.error &&
                          businessList.length === 0 && (
                            <p className="mt-4 text-sm text-neutral-500">
                              No businesses identified.
                            </p>
                          )}

                        {!category.error &&
                          businessList.length > 0 && (

                            <div className="mt-4 space-y-3">

                              {businessList
                                .slice(0, 5)
                                .map(
                                  (
                                    business,
                                    index
                                  ) => (

                                    <div
                                      key={
                                        business.id ||
                                        `${category.key}-${business.name}-${index}`
                                      }
                                      className="rounded-lg border border-black/10 bg-white p-4"
                                    >

                                      <div className="flex items-start justify-between gap-3">

                                        <div className="min-w-0">

                                          <h4 className="font-medium text-neutral-900">
                                            {business.name}
                                          </h4>

                                          {business.address && (
                                            <p className="mt-1 text-xs leading-5 text-neutral-500">
                                              {business.address}
                                            </p>
                                          )}

                                        </div>

                                        {business.rating != null && (
                                          <span className="shrink-0 text-xs font-medium text-slate-700">
                                            ★{" "}
                                            {Number(
                                              business.rating
                                            ).toFixed(1)}
                                          </span>
                                        )}

                                      </div>

                                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">

                                        {business.reviews != null &&
                                          business.reviews > 0 && (
                                            <span>
                                              {business.reviews.toLocaleString()}{" "}
                                              reviews
                                            </span>
                                          )}

                                        {business.businessStatus && (
                                          <span
                                            className={
                                              business.businessStatus ===
                                              "OPERATIONAL"
                                                ? "text-emerald-600"
                                                : "text-amber-600"
                                            }
                                          >
                                            {business.businessStatus ===
                                            "OPERATIONAL"
                                              ? "● Operational"
                                              : business.businessStatus}
                                          </span>
                                        )}

                                      </div>

                                    </div>

                                  )
                                )}

                              {businessList.length > 5 && (
                                <p className="pt-1 text-xs text-neutral-500">
                                  Showing 5 of{" "}
                                  {displayCount}{" "}
                                  businesses
                                </p>
                              )}

                            </div>

                          )}

                      </div>

                    );
                  }
                )}

              </div>

            )}

        </section>

        {/* =================================================
            COMMERCIAL OPPORTUNITY
            ================================================= */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

          <SectionTitle
            eyebrow="04 · COMMERCIAL OPPORTUNITY"
            title="Additional customer segments"
            description="Commercial establishments that can create additional Clenzit business opportunities."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <OpportunityCard
              title="Hotels"
              value={formatPlus(
                analysis.hotels
              )}
            />

            <OpportunityCard
              title="Restaurants & Cafes"
              value={formatPlus(
                analysis.restaurants
              )}
            />

            <OpportunityCard
              title="Salons & Beauty"
              value={formatPlus(
                analysis.salons
              )}
            />

            <OpportunityCard
              title="Gyms & Fitness"
              value={formatPlus(
                analysis.gyms
              )}
            />

            <OpportunityCard
              title="Corporate Offices"
              value={formatPlus(
                analysis.offices
              )}
            />

            <OpportunityCard
              title="Hospitals & Clinics"
              value={formatPlus(
                analysis.hospitals
              )}
            />

            <OpportunityCard
              title="Schools & Colleges"
              value={formatPlus(
                analysis.schools
              )}
            />

            <OpportunityCard
              title="Pet Shops & Pet Care"
              value={formatPlus(
                analysis.petShops
              )}
            />

          </div>

        </section>

        {/* =================================================
            DIGITAL INTELLIGENCE
            ================================================= */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

          <SectionTitle
            eyebrow="05 · LOCAL MARKET INTELLIGENCE"
            title="Evidence-based opportunity signals"
            description="A transparent view of local demand, competition and service gaps built from live Google Places data. No audience estimates or invented numbers."
          />

          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Every signal below is tied to verified businesses, ratings, reviews or category counts in the selected catchment.
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {analysis.customerSignals.map((signal) => (
              <div key={signal.name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-medium">{signal.name}</span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Composite local-market signal from Google Places evidence
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    VERIFIED SIGNAL
                  </span>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-lg font-black text-[#10264b]">{signal.score} / 100</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {signal.name === "Shopping Intent"
                      ? analysis.targetingContext.engagedShoppers
                      : signal.name === "Premium Lifestyle"
                        ? analysis.targetingContext.luxuryGoods
                        : signal.name === "Fashion Potential"
                          ? analysis.targetingContext.fashionApparel
                          : analysis.targetingContext.businessOwners}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </section>

        {/* =================================================
            CUSTOMER + COMPETITION
            ================================================= */}

        <section className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* CUSTOMER */}

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

            <SectionTitle
              eyebrow="06 · CUSTOMER PROFILE"
              title="Who we may be able to reach"
              description="Signals that matter to premium laundry and dry-cleaning services."
            />

            <div className="mt-6 grid grid-cols-2 gap-3">

              {analysis.customerSignals.map(
                (signal) => (

                  <div
                    key={signal.name}
                    className="rounded-xl bg-[#f5f7fa] p-4"
                  >

                    <p className="text-xs text-slate-500">
                      {signal.name}
                    </p>

                    <p className="mt-2 text-lg font-black">
                      {signal.score} / 100
                    </p>

                  </div>

                )
              )}

            </div>

          </div>

          {/* COMPETITION */}

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

            <SectionTitle
              eyebrow="07 · COMPETITION"
              title="Competitive landscape"
              description="Competition is considered as one factor within the overall territory opportunity."
            />

            <div className="mt-6 space-y-4">

              <CompetitionRow
                label="Laundry & Dry Cleaning"
                value={
                  analysis.laundryIsCapped
                    ? "20+ identified"
                    : `${analysis.laundry} identified`
                }
                positive={
                  analysis.laundry <= 5
                }
              />

              <CompetitionRow
                label="Competition Pressure"
                value={
                  analysis.competition
                }
                positive={
                  analysis.competition !==
                  "HIGH"
                }
              />

              <CompetitionRow
                label="Premium Customer Potential"
                value={
                  analysis.premiumCustomerSignal >=
                  70
                    ? "Strong"
                    : analysis.premiumCustomerSignal >=
                      50
                    ? "Good"
                    : "Developing"
                }
                positive={
                  analysis.premiumCustomerSignal >=
                  50
                }
              />

              <CompetitionRow
                label="Commercial Opportunity"
                value={
                  analysis.commercialActivity >=
                  70
                    ? "Strong"
                    : analysis.commercialActivity >=
                      50
                    ? "Good"
                    : "Developing"
                }
                positive={
                  analysis.commercialActivity >=
                  50
                }
              />

            </div>

          </div>

        </section>

        {/* =================================================
            FINAL RECOMMENDATION
            ================================================= */}

        <section className="mt-6 rounded-2xl border border-[#e4c477] bg-[#fff9e9] p-7">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a97918]">
            08 · CLENZIT RECOMMENDATION
          </p>

          <div className="mt-3 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <div>

              <h3 className="text-2xl font-bold">
                {analysis.recommendationTitle}
              </h3>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#765b20]">
                {formatLocation(location)} is being
                evaluated against Clenzit's{" "}
                {territoryModel.tierLabel.toLowerCase()}{" "}
                territory framework. The territory model
                targets approximately{" "}
                <strong>
                  {formatCompact(
                    territoryModel.minEligibleHouseholds
                  )}–
                  {formatCompact(
                    territoryModel.maxEligibleHouseholds
                  )} eligible households
                </strong>{" "}
                within a qualified franchise territory.
                Local business activity, customer signals
                and competitive conditions are also
                considered before final franchise approval.
              </p>

              <p className="mt-3 max-w-3xl text-sm font-semibold text-[#765b20]">
                Recommended next step: Detailed Franchise
                Evaluation and Territory Validation.
              </p>

            </div>

            <div className="shrink-0 rounded-xl bg-[#10264b] px-7 py-5 text-center text-white">

              <p className="text-xs text-slate-300">
                FRANCHISE SIGNAL
              </p>

              <p className="mt-1 text-lg font-black text-[#e0b65b]">
                {analysis.recommendation}
              </p>

            </div>

          </div>

        </section>

        {/* =================================================
            FOOTER
            ================================================= */}

        <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          CLENZIT Franchise Intelligence · Internal Use Only · Dynamic Territory Model
        </footer>

      </div>

    </main>
  );
}

/* =========================================================
   TERRITORY MODEL BUILDER
   ========================================================= */

function buildTerritoryModel({
  tier,
  tierLabel,
  minTerritoryHouseholds,
  maxTerritoryHouseholds,
  minEligibleHouseholds,
  maxEligibleHouseholds,
  radiusKm,
}: {
  tier: CityTier;
  tierLabel: string;
  minTerritoryHouseholds: number;
  maxTerritoryHouseholds: number;
  minEligibleHouseholds: number;
  maxEligibleHouseholds: number;
  radiusKm: number;
}): TerritoryModel {

  /*
   * This is a temporary MODEL ESTIMATE.
   *
   * It is deliberately NOT called population.
   *
   * We use radius as a basic proxy for the amount
   * of territory being evaluated.
   *
   * Later this should be replaced with actual
   * household/population data.
   */

  const radiusFactor =
    clamp(
      radiusKm / 5,
      0.5,
      2
    );

  const midpoint =
    (
      minTerritoryHouseholds +
      maxTerritoryHouseholds
    ) /
    2;

  let estimatedTerritoryHouseholds =
    Math.round(
      midpoint *
        radiusFactor
    );

  estimatedTerritoryHouseholds =
    clamp(
      estimatedTerritoryHouseholds,
      minTerritoryHouseholds,
      maxTerritoryHouseholds
    );

  const householdCoveragePercent =
    Math.round(
      (
        (
          minEligibleHouseholds +
          maxEligibleHouseholds
        ) /
        2 /
        estimatedTerritoryHouseholds
      ) *
        100
    );

  let territoryFit:
    | "STRONG"
    | "GOOD"
    | "REVIEW" =
    "GOOD";

  /*
   * Because the actual household data is not yet
   * connected, we don't want to falsely say that
   * the territory definitely qualifies.
   *
   * This is an initial model fit.
   */

  if (
    estimatedTerritoryHouseholds >=
      minTerritoryHouseholds &&
    estimatedTerritoryHouseholds <=
      maxTerritoryHouseholds
  ) {
    territoryFit = "STRONG";
  }

  if (
    tier === "tier3"
  ) {
    territoryFit = "GOOD";
  }

  return {
    tier,
    tierLabel,

    minTerritoryHouseholds,
    maxTerritoryHouseholds,

    minEligibleHouseholds,
    maxEligibleHouseholds,

    estimatedTerritoryHouseholds,

    territoryFit,

    householdCoveragePercent,
  };
}

/* =========================================================
   CITY CLASSIFIER
   ========================================================= */

function classifyCity(
  location: string
): CityTier {

  const normalized =
    location
      .toLowerCase()
      .trim();

  if (
    TIER_1_KEYWORDS.some(
      (city) =>
        normalized.includes(city)
    )
  ) {
    return "tier1";
  }

  if (
    TIER_2_KEYWORDS.some(
      (city) =>
        normalized.includes(city)
    )
  ) {
    return "tier2";
  }

  return "tier3";
}

/* =========================================================
   TERRITORY METRIC
   ========================================================= */

function TerritoryMetric({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl bg-white/70 p-4">

      <p className="text-[11px] font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-black text-[#10264b]">
        {value}
      </p>

      <p className="mt-1 text-[10px] text-slate-400">
        {subtitle}
      </p>

    </div>
  );
}

/* =========================================================
   SNAPSHOT
   ========================================================= */

function Snapshot({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl bg-[#f5f7fa] p-4">

      <p className="text-xs font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        {subtitle}
      </p>

    </div>
  );
}

/* =========================================================
   INFO CARD
   ========================================================= */

function InfoCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-[#f8fafc] p-5">

      <p className="text-xs text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-black">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        {subtitle}
      </p>

    </div>
  );
}

/* =========================================================
   OPPORTUNITY CARD
   ========================================================= */

function OpportunityCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-[#f8fafc] p-5">

      <p className="text-xs text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-black text-[#10264b]">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        identified in catchment
      </p>

    </div>
  );
}

/* =========================================================
   SECTION TITLE
   ========================================================= */

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>

      <p className="text-xs font-bold tracking-[0.16em] text-[#c4912e]">
        {eyebrow}
      </p>

      <h3 className="mt-2 text-xl font-bold">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   COMPETITION ROW
   ========================================================= */

function CompetitionRow({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#f5f7fa] px-4 py-4">

      <span className="text-sm font-medium">
        {label}
      </span>

      <span
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
          positive
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {value}
      </span>

    </div>
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-[#10264b]">{value}</p>
    </div>
  );
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN"
  ).format(value);
}

function formatCompact(
  value: number
) {
  if (value >= 100000) {
    return `${(
      value / 100000
    ).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `${(
      value / 1000
    ).toFixed(0)}K`;
  }

  return String(value);
}

function formatAudienceEstimate(
  lowerBound: number,
  upperBound: number
) {
  if (lowerBound === upperBound) {
    return `~${formatNumber(lowerBound)} people`;
  }

  return `${formatNumber(lowerBound)}–${formatNumber(upperBound)} people`;
}

function formatPlus(
  value: number
) {
  if (value >= 20) {
    return "20+";
  }

  return String(value);
}

function formatLocation(
  value: string
) {
  if (
    !value ||
    value ===
      "Loading location..." ||
    value ===
      "Unknown Location"
  ) {
    return value;
  }

  return value
    .split(",")
    .map(
      (part) =>
        part.trim()
    )
    .filter(Boolean)
    .join(", ");
}
