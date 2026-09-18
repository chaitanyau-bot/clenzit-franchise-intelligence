import { NextRequest, NextResponse } from "next/server";

type SignalKey =
  | "engagedShoppers"
  | "luxuryGoods"
  | "jewellery"
  | "fashionApparel"
  | "interiorDesign"
  | "premiumAuto"
  | "premiumSmartphones"
  | "businessOwners"
  | "travel";

type SignalDefinition = {
  key: SignalKey;
  name: string;
};

type MetaTargetingDefinitions = Partial<Record<SignalKey, Record<string, unknown>>>;

type AudienceRange = {
  lowerBound: number;
  upperBound: number;
};

// These are stable Meta catalogue definitions used when a deployment's
// configuration has not explicitly overridden them. They are intentionally
// kept separate from credentials, which remain environment-only.
const DEFAULT_TARGETING_DEFINITIONS: MetaTargetingDefinitions = {
  engagedShoppers: {
    behaviors: [{ id: "6071631541183", name: "Engaged shoppers" }],
  },
  businessOwners: {
    behaviors: [{ id: "6002714898572", name: "Small business owners" }],
  },
};

const DEMOGRAPHIC_SEGMENTS = [
  { ageRange: "18–24", ageMin: 18, ageMax: 24 },
  { ageRange: "25–34", ageMin: 25, ageMax: 34 },
  { ageRange: "35–44", ageMin: 35, ageMax: 44 },
  { ageRange: "45–54", ageMin: 45, ageMax: 54 },
  { ageRange: "55+", ageMin: 55, ageMax: 65 },
] as const;

const GENDERS = [
  { label: "Women", value: 2 },
  { label: "Men", value: 1 },
] as const;

const SIGNALS: SignalDefinition[] = [
  { key: "engagedShoppers", name: "Engaged Shoppers" },
  { key: "luxuryGoods", name: "Luxury Goods" },
  { key: "jewellery", name: "Jewellery" },
  { key: "fashionApparel", name: "Fashion / Apparel" },
  { key: "interiorDesign", name: "Interior Design" },
  { key: "premiumAuto", name: "SUV / Premium Auto" },
  { key: "premiumSmartphones", name: "Premium Smartphones" },
  { key: "businessOwners", name: "Business Owners" },
  { key: "travel", name: "Travel" },
];

function unavailableSignals(detail: string, status: "needs_configuration" | "error") {
  return SIGNALS.map((signal) => ({
    ...signal,
    status,
    source: "Meta Marketing API",
    detail,
  }));
}

function parseTargetingDefinitions(): MetaTargetingDefinitions | null {
  const raw = process.env.META_SIGNAL_TARGETING_JSON;

  if (!raw) return DEFAULT_TARGETING_DEFINITIONS;

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? {
          ...DEFAULT_TARGETING_DEFINITIONS,
          ...(parsed as MetaTargetingDefinitions),
        }
      : null;
  } catch {
    return null;
  }
}

function readAudienceEstimate(payload: unknown): AudienceRange | null {
  const first = Array.isArray((payload as { data?: unknown[] })?.data)
    ? (payload as { data: Array<Record<string, unknown>> }).data[0]
    : undefined;

  if (!first || typeof first !== "object") return null;

  const lowerBound = first.estimate_mau_lower_bound;
  const upperBound = first.estimate_mau_upper_bound;

  if (
    typeof lowerBound === "number" &&
    Number.isFinite(lowerBound) &&
    typeof upperBound === "number" &&
    Number.isFinite(upperBound)
  ) {
    return { lowerBound, upperBound };
  }

  const estimate = first.estimate_mau ?? first.users ?? first.estimate_dau;
  return typeof estimate === "number" && Number.isFinite(estimate) && estimate > 0
    ? { lowerBound: estimate, upperBound: estimate }
    : null;
}

async function getAudienceRange(
  endpoint: string,
  accessToken: string,
  targetingSpec: Record<string, unknown>
) {
  const query = new URLSearchParams({
    access_token: accessToken,
    optimization_goal: "REACH",
    targeting_spec: JSON.stringify(targetingSpec),
  });
  const response = await fetch(`${endpoint}?${query.toString()}`, {
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      error:
        payload?.error?.message ||
        "Meta could not return an audience estimate for this targeting definition.",
    };
  }

  const estimate = readAudienceEstimate(payload);
  return estimate
    ? { estimate }
    : { error: "Meta returned no usable monthly audience estimate for this targeting definition." };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("latitude"));
  const longitude = Number(searchParams.get("longitude"));
  const radiusKm = Number(searchParams.get("radiusKm") || "5");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "latitude and longitude are required" },
      { status: 400 }
    );
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const targetingDefinitions = parseTargetingDefinitions();

  if (!accessToken || !adAccountId) {
    return NextResponse.json({
      success: true,
      mode: "needs_configuration",
      signals: unavailableSignals(
        "Requires a Meta system-user access token and ad account before audience estimates can be requested.",
        "needs_configuration"
      ),
    });
  }

  if (!targetingDefinitions) {
    return NextResponse.json({
      success: true,
      mode: "needs_configuration",
      signals: unavailableSignals(
        "Meta is connected, but Clenzit-approved targeting definitions have not been configured for these signals.",
        "needs_configuration"
      ),
    });
  }

  // Accept the account ID in either Meta's displayed `act_123...` form or
  // the numeric form.  Vercel and cPanel have historically used both forms,
  // so adding `act_` unconditionally produced invalid `act_act_...` IDs.
  const normalizedAdAccountId = adAccountId.trim().replace(/^act_/i, "");
  const configuredApiVersion = (process.env.META_API_VERSION || "v24.0").trim();
  const apiVersion = /^v\d+(?:\.\d+)?$/i.test(configuredApiVersion)
    ? configuredApiVersion
    : "v24.0";

  if (
    !/^\d+$/.test(normalizedAdAccountId) ||
    normalizedAdAccountId.includes("META_API_VERSION")
  ) {
    return NextResponse.json({
      success: true,
      mode: "needs_configuration",
      signals: unavailableSignals(
        "The Meta ad account ID is invalid. Set META_AD_ACCOUNT_ID to the numeric account ID (with or without the act_ prefix).",
        "needs_configuration"
      ),
    });
  }

  const safeRadiusKm = Math.min(Math.max(radiusKm, 1), 80);
  const endpoint = `https://graph.facebook.com/${apiVersion}/act_${normalizedAdAccountId}/delivery_estimate`;

  const geoLocations = {
    custom_locations: [
      {
        latitude,
        longitude,
        radius: safeRadiusKm,
        distance_unit: "kilometer",
      },
    ],
  };

  const signals = await Promise.all(
    SIGNALS.map(async (signal) => {
      const configuredTargeting = targetingDefinitions[signal.key];

      if (!configuredTargeting) {
        return {
          ...signal,
          status: "needs_configuration",
          source: "Meta Marketing API",
          detail: "No approved Meta targeting definition has been configured for this signal.",
        };
      }

      const targetingSpec = {
        ...configuredTargeting,
        geo_locations: {
          ...(configuredTargeting.geo_locations as Record<string, unknown> | undefined),
          ...geoLocations,
        },
      };

      try {
        const result = await getAudienceRange(
          endpoint,
          accessToken,
          targetingSpec
        );

        if ("error" in result) {
          return {
            ...signal,
            status: "error",
            source: "Meta Marketing API",
            detail: result.error,
          };
        }

        return {
          ...signal,
          status: "live",
          source: "Meta Marketing API · monthly audience estimate",
          estimateLowerBound: result.estimate.lowerBound,
          estimateUpperBound: result.estimate.upperBound,
          updatedAt: new Date().toISOString(),
        };
      } catch {
        return {
          ...signal,
          status: "error",
          source: "Meta Marketing API",
          detail: "The Meta audience request could not be completed.",
        };
      }
    })
  );

  const demographics = await Promise.all(
    DEMOGRAPHIC_SEGMENTS.flatMap((segment) =>
      GENDERS.map(async (gender) => {
        const result = await getAudienceRange(endpoint, accessToken, {
          age_min: segment.ageMin,
          age_max: segment.ageMax,
          genders: [gender.value],
          geo_locations: geoLocations,
        });

        return "error" in result
          ? {
              ageRange: segment.ageRange,
              gender: gender.label,
              status: "error",
              source: "Meta Marketing API",
              detail: result.error,
            }
          : {
              ageRange: segment.ageRange,
              gender: gender.label,
              status: "live",
              source: "Meta Marketing API · monthly audience estimate",
              estimateLowerBound: result.estimate.lowerBound,
              estimateUpperBound: result.estimate.upperBound,
              updatedAt: new Date().toISOString(),
            };
      })
    )
  );

  return NextResponse.json({
    success: true,
    mode: signals.some((signal) => signal.status === "live") ? "live" : "needs_configuration",
    signals,
    demographics,
  });
}
