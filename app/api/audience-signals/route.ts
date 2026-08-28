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

  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as MetaTargetingDefinitions)
      : null;
  } catch {
    return null;
  }
}

function readAudienceEstimate(payload: unknown) {
  const first = Array.isArray((payload as { data?: unknown[] })?.data)
    ? (payload as { data: Array<Record<string, unknown>> }).data[0]
    : undefined;

  if (!first || typeof first !== "object") return null;

  const estimate = first.estimate_dau ?? first.estimate_mau ?? first.users;
  return typeof estimate === "number" && Number.isFinite(estimate)
    ? estimate
    : null;
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

  const apiVersion = process.env.META_API_VERSION || "v24.0";
  const safeRadiusKm = Math.min(Math.max(radiusKm, 1), 80);
  const endpoint = `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/delivery_estimate`;

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
          custom_locations: [
            {
              latitude,
              longitude,
              radius: safeRadiusKm,
              distance_unit: "kilometer",
            },
          ],
        },
      };

      try {
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
            ...signal,
            status: "error",
            source: "Meta Marketing API",
            detail: payload?.error?.message || "Meta could not return an audience estimate for this signal.",
          };
        }

        const estimate = readAudienceEstimate(payload);
        if (estimate === null) {
          return {
            ...signal,
            status: "error",
            source: "Meta Marketing API",
            detail: "Meta returned no usable audience estimate for this targeting definition.",
          };
        }

        return {
          ...signal,
          status: "live",
          source: "Meta Marketing API · live audience estimate",
          estimate,
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

  return NextResponse.json({
    success: true,
    mode: signals.some((signal) => signal.status === "live") ? "live" : "needs_configuration",
    signals,
  });
}
