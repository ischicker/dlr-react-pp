import React, { useMemo, useState } from 'react'
import {
  Wind,
  Thermometer,
  Zap,
  AlertTriangle,
  Snowflake,
  SunMedium,
  CloudFog,
  Gauge
} from 'lucide-react'

/**
 * Dynamic Line Rating – Alpine Edition
 * - Temperaturbereich: -20..+45 °C
 * - GHI: 0..1200 W/m²
 * - Windmittel: 0..12 m/s
 * - Böen: 0..25 m/s
 *
 * Vereinfachte Heurberechnungen, inspiriert von IEEE 738:
 * - Effektive Windgeschwindigkeit berücksichtigt Böen
 * - Leitungstemp. Tc heuristisch aus Ta, GHI, v_eff
 * - Tc wird auf [Ta-5, 80] °C begrenzt (80 °C als Betriebsgrenze)
 * - Sag ~ Sag_ref * (1 + k*(Tc - T_ref)) - c*v_eff (Visualisierungs-Näherung)
 * - DLR-Faktoren: Temperatur, Wind, Strahlung relativ zu konservativem Static-Rating
 *
 * Hinweis: Diese Demo veranschaulicht Zusammenhänge – sie ersetzt kein technisches Auslegungs-Tool.
 */

const T_REF = 25 // °C Referenz für Sag
const SAG_REF_PX = 50 // px Sag bei T_REF (reine Visualisierung)
const SAG_TEMP_COEFF = 0.005 // ~0.5% Sag-Zunahme pro K über T_REF (Visualisierung)
const SAG_WIND_LIFT = 0.5 // px Reduktion pro m/s (kleiner optischer Effekt)
const TC_MIN_DELTA = -5 // Tc darf nicht < Ta-5 fallen (numerische Bremse)
const TC_MAX = 80 // °C – typische Betriebsgrenze

const GHI_REF = 800 // W/m² – konservative Referenz für static rating
const V_REF = 0.6 // m/s – konservative Referenz für static rating
const T_STATIC_REF = 35 // °C – konservative Referenz für static rating

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

/** Effektive Windgeschwindigkeit aus Mittel + Böen */
function effectiveWindSpeed(vMean: number, vGust: number): number {
  if (vGust <= vMean) return vMean
  // Böen-Zuschlag: ~35% der Überschreitung zum Mittel
  return vMean + 0.35 * (vGust - vMean)
}

/** Heuristische Leitertemperatur in °C */
function estimateConductorTemp(ta: number, ghi: number, vEff: number): number {
  // Heuristik:
  //   Tc ≈ Ta + a*GHI - b*vEff
  //   a: 0.015 K pro (W/m²); b: 2.0 K pro (m/s)
  //   Werte so gewählt, dass 800 W/m² ~ +12 K bewirken und Wind gut kühlt.
  const a = 0.015
  const b = 2.0
  const tcRaw = ta + a * ghi - b * vEff
  const tc = clamp(tcRaw, ta + TC_MIN_DELTA, TC_MAX)
  return tc
}

/** Dynamic Rating [%] relativ zu statisch=100% */
function estimateDLRPercent(ta: number, ghi: number, vEff: number): number {
  const tempFactor = 1 + (T_STATIC_REF - ta) * 0.01 // pro K unter 35°C ~ +1%
  const windFactor = 1 + (vEff - V_REF) * 0.12 // pro 1 m/s über 0.6 ~ +12%
  const radFactor = 1 - 0.2 * ((ghi - GHI_REF) / GHI_REF) // +20% bei 0 W/m², -20% bei 1600 W/m²
  const product = 100 * tempFactor * windFactor * radFactor
  return clamp(product, 50, 170) // Klammern zur Demo-Stabilität
}

/** Alpine Risiko-Einschätzung */
function assessRisk(ta: number, vEff: number, tc: number): { level: string; color: string; bg: string } {
  // Kritisch: sehr heißer Leiter + wenig Wind
  if (tc >= 75 || (ta > 35 && vEff < 1)) {
    return { level: 'Kritisch', color: 'text-red-600', bg: 'bg-red-100' }
  }
  // Erhöht: warm + mäßig wenig Wind
  if ((ta > 30 && vEff < 2) || (tc > 60 && vEff < 2)) {
    return { level: 'Erhöht', color: 'text-orange-600', bg: 'bg-orange-100' }
  }
  // Optimal: kalt & gut durchlüftet
  if (ta < 5 && vEff > 3) {
    return { level: 'Optimal', color: 'text-green-600', bg: 'bg-green-100' }
  }
  return { level: 'Normal', color: 'text-blue-600', bg: 'bg-blue-100' }
}

/** Schnee/Vereisungsindikatoren (heuristisch, ohne Niederschlag) */
function iceSnowFlags(ta: number, ghi: number, vEff: number) {
  const lowRad = ghi < 150
  const veryLowRad = ghi < 60

  const icingHigh =
    ta >= -10 && ta <= 1 && vEff <= 3 && lowRad // typisch für Rime/Glaze – Nebel + schwacher Wind + um 0°C
  const icingModerate =
    ta >= -15 && ta <= 2 && vEff <= 5 && veryLowRad

  const snowRisk =
    ta >= -5 && ta <= 2 && ghi < 200 // Nassschnee-/Anhaftungsfenster

  return {
    icing: icingHigh ? 'hoch' : icingModerate ? 'moderat' : 'gering',
    snow: snowRisk ? 'möglich' : 'unwahrscheinlich'
  }
}

/** Sag (px) aus Tc (vereinfachte Visualisierung) */
function estimateSagPx(tc: number, vEff: number): number {
  // Sag steigt mit Tc durch Ausdehnung; Wind hebt minimal (optische Stabilisierung)
  const sag = SAG_REF_PX * (1 + SAG_TEMP_COEFF * (tc - T_REF)) - SAG_WIND_LIFT * vEff
  return clamp(sag, 30, 120)
}

const DynamicLineRating: React.FC = () => {
  const [temperature, setTemperature] = useState(0) // °C (Alpen: -20..45)
  const [windSpeed, setWindSpeed] = useState(2) // m/s
  const [windGust, setWindGust] = useState(8) // m/s
  const [ghi, setGhi] = useState(400) // W/m²

  const staticRating = 100 // 100% bei (35°C, 0.6 m/s, ~800 W/m²)

  const vEff = useMemo(() => effectiveWindSpeed(windSpeed, windGust), [windSpeed, windGust])
  const tc = useMemo(() => estimateConductorTemp(temperature, ghi, vEff), [temperature, ghi, vEff])
  const dynamicRating = useMemo(() => estimateDLRPercent(temperature, ghi, vEff), [temperature, ghi, vEff])
  const capacityDiff = useMemo(
    () => (((dynamicRating - staticRating) / staticRating) * 100).toFixed(1),
    [dynamicRating]
  )
  const risk = useMemo(() => assessRisk(temperature, vEff, tc), [temperature, vEff, tc])
  const { icing, snow } = useMemo(() => iceSnowFlags(temperature, ghi, vEff), [temperature, ghi, vEff])
  const sag = useMemo(() => estimateSagPx(tc, vEff), [tc, vEff])

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Dynamic Line Rating (DLR) – Alpen-Edition</h2>
        <p className="text-gray-600 text-sm">
          Einfluss von Temperatur, Wind (inkl. Böen) und Strahlung auf Kapazität & Durchhang von Freileitungen
        </p>
      </div>

      {/* Visualisierung */}
      <div className="bg-gradient-to-b from-sky-100 to-sky-50 rounded-lg p-8 mb-6 relative overflow-hidden">
        {/* Sonne je nach GHI */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <SunMedium className={ghi > 600 ? 'text-yellow-400' : 'text-gray-400'} />
          <span className="text-sm text-gray-700">{ghi} W/m²</span>
        </div>

        {/* Wind-Indikator mit Böen */}
        <div className="absolute top-4 left-4 text-sm">
          <div className="flex items-center gap-2">
            <Wind className={`${vEff > 5 ? 'text-blue-600' : 'text-gray-400'}`} />
            <div className="flex gap-2">
              <span className="font-semibold">{vEff.toFixed(1)} m/s</span>
              <span className="text-gray-600">(eff.)</span>
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            Mittel: {windSpeed.toFixed(1)} m/s • Böe: {windGust.toFixed(1)} m/s
          </div>
        </div>

        {/* Strommasten und Leitung */}
        <svg viewBox="0 0 800 200" className="w-full">
          {/* Linker Mast */}
          <g>
            <rect x="50" y="80" width="8" height="100" fill="#666" />
            <polygon points="54,80 34,100 74,100" fill="#666" />
            <circle cx="54" cy="85" r="3" fill="#333" />
          </g>

          {/* Rechter Mast */}
          <g>
            <rect x="742" y="80" width="8" height="100" fill="#666" />
            <polygon points="746,80 726,100 766,100" fill="#666" />
            <circle cx="746" cy="85" r="3" fill="#333" />
          </g>

          {/* Leiter mit Durchhang */}
          <path
            d={`M 54,85 Q 400,${85 + sag} 746,85`}
            stroke={tc > 70 && vEff < 1 ? '#ef4444' : '#1e40af'}
            strokeWidth="4"
            fill="none"
          />

          {/* Warnblase bei heißem Leiter und wenig Wind */}
          {tc >= 75 && vEff < 2 && (
            <>
              <circle cx="400" cy={85 + sag} r="20" fill="#fee2e2" opacity={0.8} />
              <text x="400" y={85 + sag + 5} textAnchor="middle" fontSize="20">
                ⚠️
              </text>
            </>
          )}

          {/* Durchhang-Annotation */}
          <line x1="400" y1="85" x2="400" y2={85 + sag} stroke="#999" strokeDasharray="2,2" strokeWidth="1" />
          <text x="410" y={(85 + (85 + sag)) / 2} fontSize="12" fill="#666">
            Durchhang: {sag.toFixed(0)} px
          </text>
        </svg>

        {/* Schnee/Vereisung Badge */}
        <div className="absolute bottom-4 right-4 flex items-center gap-3">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm">
            <Snowflake size={16} />
            <span>Schnee: {snow}</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-sm">
            <CloudFog size={16} />
            <span>Vereisung: {icing}</span>
          </div>
        </div>
      </div>

      {/* Kontroll-Panel */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Temperatur */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="text-red-500" />
            <label className="font-semibold">Lufttemperatur</label>
          </div>
          <input
            type="range"
            min={-20}
            max={45}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>-20°C</span>
            <span className="font-bold text-lg">{temperature}°C</span>
            <span>45°C</span>
          </div>
        </div>

        {/* Wind (Mittel) */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Wind className="text-blue-500" />
            <label className="font-semibold">Windgeschwindigkeit (Mittel)</label>
          </div>
          <input
            type="range"
            min={0}
            max={12}
            step={0.5}
            value={windSpeed}
            onChange={(e) => setWindSpeed(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>0 m/s</span>
            <span className="font-bold text-lg">{windSpeed} m/s</span>
            <span>12 m/s</span>
          </div>
        </div>

        {/* Wind (Böe) */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="text-blue-600" />
            <label className="font-semibold">Windböen</label>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            step={0.5}
            value={windGust}
            onChange={(e) => setWindGust(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>0 m/s</span>
            <span className="font-bold text-lg">{windGust} m/s</span>
            <span>25 m/s</span>
          </div>
        </div>

        {/* Strahlung */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <SunMedium className="text-yellow-500" />
            <label className="font-semibold">Globalstrahlung (GHI)</label>
          </div>
          <input
            type="range"
            min={0}
            max={1200}
            step={10}
            value={ghi}
            onChange={(e) => setGhi(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>0</span>
            <span className="font-bold text-lg">{ghi} W/m²</span>
            <span>1200</span>
          </div>
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded-lg text-center">
          <div className="text-sm text-gray-600 mb-1">Statisches Rating</div>
          <div className="text-3xl font-bold text-gray-700">{staticRating}%</div>
          <div className="text-xs text-gray-500 mt-1">(35°C, 0.6 m/s, ~800 W/m²)</div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg text-center border-2 border-blue-500">
          <div className="text-sm text-blue-600 mb-1 flex items-center justify-center gap-1">
            <Zap size={16} />
            Dynamic Line Rating
          </div>
          <div className="text-3xl font-bold text-blue-700">{dynamicRating.toFixed(0)}%</div>
          <div className={`text-sm mt-1 font-semibold ${Number(capacityDiff) > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {Number(capacityDiff) > 0 ? '+' : ''}{capacityDiff}%
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Tc ≈ <span className="font-semibold">{tc.toFixed(1)}°C</span> (max {TC_MAX}°C)
          </div>
        </div>

        <div className={`${risk.bg} p-4 rounded-lg text-center`}>
          <div className="text-sm text-gray-600 mb-1">Risikobewertung</div>
          <div className={`text-2xl font-bold ${risk.color} flex items-center justify-center gap-2`}>
            {risk.level === 'Kritisch' && <AlertTriangle size={24} />}
            {risk.level}
          </div>
        </div>
      </div>

      {/* Erklärungen */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Zap size={18} className="text-blue-600" />
          Interpretation
        </h3>
        <div className="text-sm space-y-2">
          <p>
            <strong>Static:</strong> Konservative Annahmen (heiß, kaum Wind, mittlere Strahlung) – schützt, nutzt aber
            nicht die volle Kapazität.
          </p>
          <p>
            <strong>Dynamic:</strong> Nutzt <em>aktuelle</em> Bedingungen: kühle Luft, hohe Windgeschwindigkeit
            (inkl. Böen) und geringe Strahlung erhöhen die zulässige Stromstärke.
          </p>
          <p>
            <strong>Leitertemperatur & Sag:</strong> Höhere Tc → stärkerer Durchhang. In dieser Demo wird Tc aus Ta, GHI
            und effektiver Windgeschwindigkeit heuristisch geschätzt und bei {TC_MAX}°C begrenzt.
          </p>
          <p className="text-red-700">
            <strong>⚠️ Vereisung/Schee:</strong> Bei Temperaturen um 0°C, schwachem Wind und niedriger Strahlung sind
            Vereisung und Nassschnee-Ablagerungen möglich – mechanisches Risiko & erhöhter Durchhang.
          </p>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 italic">
        Heuristische Demo inspiriert von IEEE&nbsp;Std&nbsp;738; Parameter für den Alpenraum angepasst.
      </div>
    </div>
  )
}

export default DynamicLineRating
