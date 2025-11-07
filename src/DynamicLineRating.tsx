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
 * Dynamic Line Rating – Alpen Edition (IEEE-like ⇄ CIGRÉ-like)
 *
 * Diese Variante erlaubt die Wahl zwischen zwei Wärmebilanz-Varianten:
 *  - "IEEE-like": Heuristische h_c(v) (vorherige Version)
 *  - "CIGRÉ-like": Aufteilung Konvektion in natürliche + erzwungene Konvektion mit
 *                   korrelationsbasierten Exponenten (didaktisch angenähert)
 *
 *  HINWEIS: Die CIGRÉ-Variante nutzt frei gewählte Koeffizienten in typischer Größenordnung,
 *  um die Charakteristik der TB601-Korrelationsform einzufangen. Für echte Auslegung sind
 *  leiter-/oberflächenspezifische, standardkonforme Parameter zu verwenden.
 */

// --- Visual-/UI-Parameter ---
const T_REF = 25 // °C, Referenz für Sag-Visualisierung
const SAG_REF_PX = 50 // px bei T_REF
const SAG_TEMP_COEFF = 0.005 // ~0.5% Sag-Zunahme pro K über T_REF (visual)
const SAG_WIND_LIFT = 0.5 // px Reduktion pro m/s (visual)
const TC_MIN_DELTA = -5 // Tc >= Ta-5
const TC_MAX = 80 // °C (Betriebsgrenze/Design-Limit)

// --- Statischer Referenzfall für DLR% ---
const GHI_REF = 800 // W/m²
const V_REF = 0.6 // m/s
const T_STATIC_REF = 35 // °C

// --- Physikalische Konstanten & Leiterparameter (didaktisch) ---
const SIGMA = 5.670374419e-8 // W/m²/K⁴ (Stefan-Boltzmann)
const EPS = 0.8 // Emissivität [-]
const ALPHA_SOLAR = 0.5 // Absorptivität [-]
const DIAM = 0.028 // m, Leiternenn-Durchmesser (z.B. ~28 mm)
const PERIM = Math.PI * DIAM // Wärmeaustausch-Umfang je m
const R20_PER_M = 3.0e-5 // Ω/m bei 20°C (≈0.03 Ω/km)
const ALPHA_R = 0.0039 // 1/K Temperaturkoeff. Widerstand

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const C2K = (tC: number) => tC + 273.15

// --- Modellwahl ---
type ModelType = 'ieee' | 'cigre'

/** effektive Windgeschwindigkeit aus Mittel + Böen */
function effectiveWindSpeed(vMean: number, vGust: number): number {
  if (vGust <= vMean) return vMean
  return vMean + 0.35 * (vGust - vMean) // 35% Böenanteil
}

/** Widerstand bei Tc [Ω/m] */
function resistancePerM(tc: number): number {
  return R20_PER_M * (1 + ALPHA_R * (tc - 20))
}

/** Wärmeflüsse [W/m] */
function qJoule(I: number, tc: number): number {
  const R = resistancePerM(tc)
  return I * I * R
}
function qSolar(ghi: number): number {
  return ALPHA_SOLAR * ghi * DIAM // projizierte Fläche/m ~ D
}
function qRadiative(ta: number, tc: number): number {
  const Tk = C2K(tc)
  const Tak = C2K(ta)
  return EPS * SIGMA * (Tk ** 4 - Tak ** 4) * PERIM
}

/** IEEE-like: h_c(v) [W/m²K] einfache Heuristik */
function hConvectiveIEEE(vEff: number): number {
  return 5 + 8 * Math.sqrt(Math.max(0, vEff) + 0.1)
}
function qConvectiveIEEE(vEff: number, ta: number, tc: number): number {
  const h = hConvectiveIEEE(vEff)
  return h * (tc - ta) * PERIM
}

/** CIGRÉ-like: Konvektion als Summe aus natürlicher + erzwungener Komponente
 *  q_nat  = Cn * (ΔT)^1.25 * D^0.75
 *  q_for  = Cf * v_eff^m * (ΔT)^n * D^0.75
 *  q_conv = q_nat + q_for   (didaktische Summation, alternative Wurzel-Überlagerung möglich)
 *  Koeffizienten sind heuristisch gewählt, um Größenordnungen zu treffen.
 */
const CIGRE_CN = 3.6 // ~W/m/K^1.25 * m^-0.75
const CIGRE_CF = 7.2 // ~W/m/(m/s)^m/K^n * m^-0.75
const CIGRE_M = 0.52 // Exponent für v_eff
const CIGRE_N = 1.25 // Exponent für ΔT

function qConvectiveCIGRE(vEff: number, ta: number, tc: number): number {
  const dT = Math.max(0, tc - ta)
  const D075 = Math.pow(DIAM, 0.75)
  const q_nat = CIGRE_CN * Math.pow(dT, CIGRE_N) * D075
  const q_for = CIGRE_CF * Math.pow(Math.max(0, vEff), CIGRE_M) * Math.pow(dT, CIGRE_N) * D075
  return q_nat + q_for
}

/**
 * Tc-Löser (stationär) für gegebenes Modell und (Ta, vEff, GHI, I)
 */
function solveConductorTemp(ta: number, vEff: number, ghi: number, I: number, model: ModelType): number {
  let tc = clamp(ta + 10, ta + TC_MIN_DELTA, TC_MAX) // initial guess
  for (let k = 0; k < 60; k++) {
    const q_in = qJoule(I, tc) + qSolar(ghi)
    const q_out_conv = model === 'ieee' ? qConvectiveIEEE(vEff, ta, tc) : qConvectiveCIGRE(vEff, ta, tc)
    const q_out = q_out_conv + qRadiative(ta, tc)
    const resid = q_in - q_out

    // numerischer Dämpfer: dQ/dT der Abkühlung
    const h_eq = model === 'ieee' ? hConvectiveIEEE(vEff) : (qConvectiveCIGRE(vEff, ta, tc + 0.5) - qConvectiveCIGRE(vEff, ta, tc)) / 0.5 / PERIM
    const dQdT = Math.max(1e-6, h_eq * PERIM + 4 * EPS * SIGMA * Math.pow(C2K(tc), 3) * PERIM)
    const step = resid / dQdT
    tc = clamp(tc + step, ta + TC_MIN_DELTA, TC_MAX)
    if (Math.abs(step) < 0.02) break
  }
  return tc
}

function estimateConductorTemp(ta: number, ghi: number, vEff: number, I: number, model: ModelType): number {
  return solveConductorTemp(ta, vEff, ghi, I, model)
}

/** Ampacity: größtes I mit Tc = TC_MAX */
function solveAmpacity(ta: number, ghi: number, vEff: number, model: ModelType): number {
  let lo = 0
  let hi = 4000
  let tc_lo = estimateConductorTemp(ta, ghi, vEff, lo, model)
  if (tc_lo >= TC_MAX - 0.05) return 0
  let tc_hi = estimateConductorTemp(ta, ghi, vEff, hi, model)
  let guard = 0
  while (tc_hi < TC_MAX && guard < 10) {
    hi *= 1.5
    tc_hi = estimateConductorTemp(ta, ghi, vEff, hi, model)
    guard++
  }
  for (let k = 0; k < 40; k++) {
    const mid = 0.5 * (lo + hi)
    const tc_mid = estimateConductorTemp(ta, ghi, vEff, mid, model)
    if (tc_mid > TC_MAX) hi = mid; else lo = mid
    if (Math.abs(tc_mid - TC_MAX) < 0.05 || (hi - lo) < 0.5) return mid
  }
  return 0.5 * (lo + hi)
}

function staticAmpacityRef(model: ModelType): number {
  return solveAmpacity(T_STATIC_REF, GHI_REF, V_REF, model)
}

/** Alpine Risiko (inkl. Stromnähe zu Ampacity) */
function assessRisk(ta: number, vEff: number, tc: number, I: number, Imax: number) {
  if (I >= 0.98 * Imax || tc >= 78) {
    return { level: 'Kritisch', color: 'text-red-600', bg: 'bg-red-100' }
  }
  if ((ta > 30 && vEff < 2) || (tc > 60 && vEff < 2) || I >= 0.9 * Imax) {
    return { level: 'Erhöht', color: 'text-orange-600', bg: 'bg-orange-100' }
  }
  if (ta < 5 && vEff > 3 && I <= 0.7 * Imax) {
    return { level: 'Optimal', color: 'text-green-600', bg: 'bg-green-100' }
  }
  return { level: 'Normal', color: 'text-blue-600', bg: 'bg-blue-100' }
}

/** Schnee/Vereisung (Heuristik) */
function iceSnowFlags(ta: number, ghi: number, vEff: number) {
  const lowRad = ghi < 150
  const veryLowRad = ghi < 60
  const icingHigh = ta >= -10 && ta <= 1 && vEff <= 3 && lowRad
  const icingModerate = ta >= -15 && ta <= 2 && vEff <= 5 && veryLowRad
  const snowRisk = ta >= -5 && ta <= 2 && ghi < 200
  return { icing: icingHigh ? 'hoch' : icingModerate ? 'moderat' : 'gering', snow: snowRisk ? 'möglich' : 'unwahrscheinlich' }
}

/** Sag (px) aus Tc (visual) */
function estimateSagPx(tc: number, vEff: number): number {
  const sag = SAG_REF_PX * (1 + SAG_TEMP_COEFF * (tc - T_REF)) - SAG_WIND_LIFT * vEff
  return clamp(sag, 30, 120)
}

const DynamicLineRating: React.FC = () => {
  // Alpen-gerechte Defaults
  const [temperature, setTemperature] = useState(0)
  const [windSpeed, setWindSpeed] = useState(2)
  const [windGust, setWindGust] = useState(8)
  const [ghi, setGhi] = useState(400)
  const [current, setCurrent] = useState(600)
  const [model, setModel] = useState<ModelType>('ieee')

  const vEff = useMemo(() => effectiveWindSpeed(windSpeed, windGust), [windSpeed, windGust])

  const Imax = useMemo(() => solveAmpacity(temperature, ghi, vEff, model), [temperature, ghi, vEff, model])
  const I_static = useMemo(() => staticAmpacityRef(model), [model])
  const Tc = useMemo(() => estimateConductorTemp(temperature, ghi, vEff, current, model), [temperature, ghi, vEff, current, model])

  const dlrPercent = useMemo(() => clamp((Imax / Math.max(1e-6, I_static)) * 100, 0, 300), [Imax, I_static])
  const capacityDiff = useMemo(() => (dlrPercent - 100).toFixed(1), [dlrPercent])

  const risk = useMemo(() => assessRisk(temperature, vEff, Tc, current, Imax), [temperature, vEff, Tc, current, Imax])
  const { icing, snow } = useMemo(() => iceSnowFlags(temperature, ghi, vEff), [temperature, ghi, vEff])
  const sag = useMemo(() => estimateSagPx(Tc, vEff), [Tc, vEff])

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Dynamic Line Rating (DLR) – Alpen-Edition</h2>
        <p className="text-gray-600 text-sm">Wärmebilanz mit Leiterstrom, Böen & Strahlung · Tc_max = {TC_MAX}°C · Modell: <b>{model.toUpperCase()}</b></p>
      </div>

      {/* Modell-Wahlschalter */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="radio" name="model" value="ieee" checked={model === 'ieee'} onChange={() => setModel('ieee')} />
          <span className="text-sm">IEEE-like</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="radio" name="model" value="cigre" checked={model === 'cigre'} onChange={() => setModel('cigre')} />
          <span className="text-sm">CIGRÉ-like (nat.+erz. Konvektion)</span>
        </label>
      </div>

      {/* Visualisierung */}
      <div className="bg-gradient-to-b from-sky-100 to-sky-50 rounded-lg p-8 mb-6 relative overflow-hidden">
        {/* Sonne / GHI */}
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
          <path d={`M 54,85 Q 400,${85 + sag} 746,85`} stroke={Tc > 70 && vEff < 1 ? '#ef4444' : '#1e40af'} strokeWidth="4" fill="none" />

          {/* Warnblase bei heißem Leiter und wenig Wind */}
          {Tc >= 75 && vEff < 2 && (
            <>
              <circle cx="400" cy={85 + sag} r="20" fill="#fee2e2" opacity={0.8} />
              <text x="400" y={85 + sag + 5} textAnchor="middle" fontSize="20">⚠️</text>
            </>
          )}

          {/* Durchhang-Annotation */}
          <line x1="400" y1="85" x2="400" y2={85 + sag} stroke="#999" strokeDasharray="2,2" strokeWidth="1" />
          <text x="410" y={(85 + (85 + sag)) / 2} fontSize="12" fill="#666">Durchhang: {sag.toFixed(0)} px</text>
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
          <input type="range" min={-20} max={45} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full" />
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
          <input type="range" min={0} max={12} step={0.5} value={windSpeed} onChange={(e) => setWindSpeed(Number(e.target.value))} className="w-full" />
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
          <input type="range" min={0} max={25} step={0.5} value={windGust} onChange={(e) => setWindGust(Number(e.target.value))} className="w-full" />
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
          <input type="range" min={0} max={1200} step={10} value={ghi} onChange={(e) => setGhi(Number(e.target.value))} className="w-full" />
          <div className="flex justify-between text-sm mt-2">
            <span>0</span>
            <span className="font-bold text-lg">{ghi} W/m²</span>
            <span>1200</span>
          </div>
        </div>

        {/* Leiterstrom */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="text-blue-700" />
            <label className="font-semibold">Leiterstrom</label>
          </div>
          <input type="range" min={0} max={1500} step={10} value={current} onChange={(e) => setCurrent(Number(e.target.value))} className="w-full" />
          <div className="flex justify-between text-sm mt-2">
            <span>0 A</span>
            <span className="font-bold text-lg">{current} A</span>
            <span>1500 A</span>
          </div>
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded-lg text-center">
          <div className="text-sm text-gray-600 mb-1">Ampacity (statisch, Referenz)</div>
          <div className="text-3xl font-bold text-gray-700">{I_static.toFixed(0)} A</div>
          <div className="text-xs text-gray-500 mt-1">(35°C, 0.6 m/s, 800 W/m²)</div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg text-center border-2 border-blue-500">
          <div className="text-sm text-blue-600 mb-1 flex items-center justify-center gap-1">
            <Zap size={16} />
            Ampacity (aktuell)
          </div>
          <div className="text-3xl font-bold text-blue-700">{Imax.toFixed(0)} A</div>
          <div className={`text-sm mt-1 font-semibold ${dlrPercent >= 100 ? 'text-green-600' : 'text-red-600'}`}>
            DLR: {dlrPercent.toFixed(0)}% {dlrPercent - 100 >= 0 ? '(+' : '('}{(dlrPercent - 100).toFixed(1)}%)
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Tc (bei {current} A) ≈ <span className="font-semibold">{Tc.toFixed(1)}°C</span> (max {TC_MAX}°C)
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
            <strong>Modellwahl:</strong> <em>IEEE-like</em> nutzt ein einfaches h_c(v), <em>CIGRÉ-like</em> addiert natürliche + erzwungene Konvektion mit typischen Exponenten. Parameter sind didaktisch gesetzt.
          </p>
          <p>
            <strong>Ampacity (aktuell):</strong> Maximaler Strom für Tc = {TC_MAX}°C unter den gewählten Bedingungen.
            DLR% setzt diese Ampacity zur konservativen Referenz in Beziehung.
          </p>
          <p>
            <strong>Sag:</strong> Visualisierung der temperaturbedingten Ausdehnung inkl. kleinen windexponierten Korrekturen.
          </p>
          <p className="text-red-700">
            <strong>Vereisung/Schnee:</strong> Heuristische Indikatoren (ohne Niederschlag). Mechanische Zusatzlasten sind
            nicht in der Ampacity enthalten.
          </p>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 italic">
        Didaktische Näherungen – nicht für den operativen Einsatz ohne leiterspezifische Kalibrierung nach IEEE/CIGRÉ.
      </div>
    </div>
  )
}

export default DynamicLineRating
