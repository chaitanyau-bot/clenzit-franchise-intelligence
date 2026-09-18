"use client";

import { useState } from "react";

const recentAreas = [
  {
    location: "Karjat, Maharashtra",
    score: 74,
    status: "Good Potential",
    date: "Today",
  },
  {
    location: "Dharwad, Karnataka",
    score: 78,
    status: "Strong Potential",
    date: "Yesterday",
  },
];

const CATCHMENT_RADII_KM = Array.from({ length: 15 }, (_, index) => index + 1);

export default function Home() {
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState("15 km");
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState("");

 function analyzeArea() {
  if (!location.trim()) {
    setMessage("Please enter a city or location.");
    return;
  }

  const locationValue = encodeURIComponent(location.trim());
  const radiusValue = encodeURIComponent(radius.replace(" km", ""));

  window.location.href = `/analyze?location=${locationValue}&radius=${radiusValue}`;
}
  

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#10264b]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-[0.18em]">
                CLENZIT
              </h1>
              <span className="text-xl text-[#d6a13b]">✦</span>
            </div>

            <p className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-slate-500">
              FRANCHISE INTELLIGENCE
            </p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold text-slate-400">
              INTERNAL TOOL
            </p>
            <p className="text-sm font-semibold">Area Expansion</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Welcome */}
        <section className="mb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-[#c4912e]">
            Franchise Expansion
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Find the next Clenzit location.
          </h2>

          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">
            Analyze a city or catchment area using market size, digital
            demand, customer profile, competition and other signals.
          </p>
        </section>

        {/* Analyzer */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold">Area Analyzer</h3>
            <p className="mt-1 text-sm text-slate-500">
              Enter a location to begin a franchise potential analysis.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
            {/* Location */}
            <div>
              <label className="mb-2 block text-sm font-semibold">
                City / Location
              </label>

              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") analyzeArea();
                }}
                placeholder="e.g. Karjat, Maharashtra"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#c4912e] focus:ring-2 focus:ring-[#c4912e]/10"
              />
            </div>

            {/* Radius */}
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Catchment Radius
              </label>

              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm outline-none focus:border-[#c4912e]"
              >
                {CATCHMENT_RADII_KM.map((kilometres) => (
                  <option key={kilometres}>{kilometres} km</option>
                ))}
              </select>
            </div>

            {/* Button */}
            <button
              onClick={analyzeArea}
              disabled={analyzing}
              className="rounded-xl bg-[#10264b] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#193966] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {analyzing ? "ANALYZING..." : "ANALYZE AREA"}
            </button>
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-[#e4c477] bg-[#fff9e9] px-4 py-3 text-sm font-medium text-[#765b20]">
              {message}
            </div>
          )}
        </section>

        {/* Dashboard cards */}
        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <DashboardCard
            title="Areas Analyzed"
            value="02"
            subtitle="Locations in your pipeline"
          />

          <DashboardCard
            title="Strong Potential"
            value="01"
            subtitle="Currently identified"
          />

          <DashboardCard
            title="Average Score"
            value="76"
            subtitle="Out of 100"
          />
        </section>

        {/* Recent analysis */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h3 className="text-lg font-bold">Recent Area Analyses</h3>
              <p className="mt-1 text-sm text-slate-500">
                Your latest franchise location evaluations.
              </p>
            </div>

            <button className="hidden text-sm font-semibold text-[#b17c1c] sm:block">
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentAreas.map((area) => (
              <div
                key={area.location}
                className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{area.location}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Analyzed {area.date}
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    {area.status}
                  </span>

                  <div className="text-right">
                    <p className="text-2xl font-black">{area.score}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Score
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Coming soon */}
        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <FeatureCard
            number="01"
            title="Market Intelligence"
            description="Population, households and serviceable catchment."
          />

          <FeatureCard
            number="02"
            title="Digital Intelligence"
            description="Meta audience and customer targeting signals."
          />

          <FeatureCard
            number="03"
            title="Competition Intelligence"
            description="Local laundry and dry-cleaning competition."
          />
        </section>

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          CLENZIT Franchise Intelligence · Internal Use Only
        </footer>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-[#10264b]">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-400">{subtitle}</p>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <span className="text-xs font-black tracking-widest text-[#c4912e]">
        {number}
      </span>

      <h3 className="mt-3 font-bold">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
