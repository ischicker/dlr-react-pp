import React, { useState } from 'react'
import { Wind, Thermometer, Zap, AlertTriangle } from 'lucide-react'

const DynamicLineRating: React.FC = () => {
  const [temperature, setTemperature] = useState(25)
  const [windSpeed, setWindSpeed] = useState(2)

  // Statisches Rating bei konservativen Bedingungen (35°C, 0.6 m/s Wind)
  const staticRating = 100

  // Vereinfachte DLR-Berechnung (basierend auf IEEE 738)
  // Bei niedrigerer Temperatur und höherem Wind steigt die Kapazität
  const calculateDLR = (temp: number, wind: number) => {
    const tempFactor = 1 + (35 - temp) * 0.01 // pro °C unter 35°C: +1%
    const windFactor = 1 + (wind - 0.6) * 0.15 // pro m/s über 0.6: +15%
    return Math.max(70, Math.min(150, staticRating * tempFactor * windFactor))
  }

  const dynamicRating = calculateDLR(temperature, windSpeed)
  const capacityDiff = (((dynamicRating - staticRating) / staticRating) * 100).toFixed(1)

  // Risikobewertung
  const getRiskLevel = () => {
    if (temperature > 35 && windSpeed < 1) return { level: 'Kritisch', color: 'text-red-600', bg: 'bg-red-100' }
    if (temperature > 30 && windSpeed < 2) return { level: 'Erhöht', color: 'text-orange-600', bg: 'bg-orange-100' }
    if (temperature < 20 && windSpeed > 5) return { level: 'Optimal', color: 'text-green-600', bg: 'bg-green-100' }
    return { level: 'Normal', color: 'text-blue-600', bg: 'bg-blue-100' }
  }

  const risk = getRiskLevel()

  // Leiter-Durchhang Visualisierung
  const calculateSag = () => {
    // Höherer Durchhang bei höherer Temperatur und geringerem Wind
    const baseSag = 50
    const tempEffect = (temperature - 20) * 1.5
    const windEffect = -(windSpeed - 2) * 2
    return Math.max(30, Math.min(70, baseSag + tempEffect + windEffect))
  }

  const sag = calculateSag()

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Dynamic Line Rating (DLR)</h2>
        <p className="text-gray-600 text-sm">
          Einfluss von Temperatur und Wind auf die Übertragungskapazität von Freileitungen
        </p>
      </div>

      {/* Freileitung Visualisierung */}
      <div className="bg-gradient-to-b from-sky-100 to-sky-50 rounded-lg p-8 mb-6 relative overflow-hidden">
        {/* Sonne/Wolken je nach Temperatur */}
        <div className="absolute top-4 right-4">
          {temperature > 30 ? (
            <div className="text-yellow-400 text-4xl">☀️</div>
          ) : (
            <div className="text-gray-400 text-4xl">☁️</div>
          )}
        </div>

        {/* Wind-Indikator */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Wind className={`${windSpeed > 5 ? 'text-blue-600' : 'text-gray-400'}`} />
          <div className="flex gap-1">
            {Array.from({ length: Math.max(1, Math.ceil(windSpeed / 2)) }).map((_, i) => (
              <div key={i} className="text-blue-400">→</div>
            ))}
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
            stroke={temperature > 35 && windSpeed < 1 ? '#ef4444' : '#1e40af'}
            strokeWidth="4"
            fill="none"
          />

          {/* Temperatur-Warnung bei kritischen Bedingungen */}
          {temperature > 35 && windSpeed < 1 && (
            <>
              <circle cx="400" cy={85 + sag} r="20" fill="#fee2e2" opacity={0.8} />
              <text x="400" y={85 + sag + 5} textAnchor="middle" fontSize="20">⚠️</text>
            </>
          )}

          {/* Durchhang-Annotation */}
          <line x1="400" y1="85" x2="400" y2={85 + sag} stroke="#999" strokeDasharray="2,2" strokeWidth="1" />
          <text x="410" y={(85 + (85 + sag)) / 2} fontSize="12" fill="#666">
            Durchhang: {sag.toFixed(0)}mm
          </text>
        </svg>
      </div>

      {/* Kontroll-Panel */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Temperatur */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="text-red-500" />
            <label className="font-semibold">Umgebungstemperatur</label>
          </div>
          <input
            type="range"
            min={10}
            max={45}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>10°C</span>
            <span className="font-bold text-lg">{temperature}°C</span>
            <span>45°C</span>
          </div>
        </div>

        {/* Wind */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Wind className="text-blue-500" />
            <label className="font-semibold">Windgeschwindigkeit</label>
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
      </div>

      {/* Kapazitäts-Vergleich */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded-lg text-center">
          <div className="text-sm text-gray-600 mb-1">Statisches Rating</div>
          <div className="text-3xl font-bold text-gray-700">{staticRating}%</div>
          <div className="text-xs text-gray-500 mt-1">(Konservativ: 35°C, 0.6 m/s)</div>
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
            <strong>Statisches Rating:</strong> Basiert auf konservativen Annahmen (hohe Temperatur, wenig Wind).
            Schützt die Leitung, nutzt aber nicht die volle Kapazität.
          </p>
          <p>
            <strong>Dynamic Line Rating:</strong> Nutzt Echtzeit-Wetterdaten zur optimalen Ausnutzung der Leitungskapazität.
            Bei günstigen Bedingungen (kühl + windig) kann die Kapazität um 30–50% steigen.
          </p>
          <p className="text-red-700">
            <strong>⚠️ Kritisch bei Hitzewellen:</strong> Hohe Temperatatur + schwacher Wind führen zu:
            • Erhöhtem Leiterwiderstand • Stärkerem Durchhang • Reduzierter Übertragungskapazität (15–30% Verlust)
          </p>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 italic">
        Basierend auf: IEEE Std 738-2023 & Karimi et al. (2018), Renewable and Sustainable Energy Reviews
      </div>
    </div>
  )
}

export default DynamicLineRating
