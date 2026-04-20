import { useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTrip } from '../context/TripContext'
import { useTransportData } from '../hooks/useTransportData'
import { useTripAuth } from '../hooks/useTripAuth'

const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.07 } } }
const fadeUp  = { hidden:{ opacity:0, y:20 }, visible:{ opacity:1, y:0, transition:{ duration:0.4 } } }

const MODE_META = {
  flight: { icon:'✈️', label:'Flights',  color:'from-orange-50 to-amber-50',     border:'border-orange-200', badge:'bg-orange-100 text-orange-700' },
  train:  { icon:'🚂', label:'Trains',   color:'from-amber-50 to-yellow-50',     border:'border-amber-200',  badge:'bg-amber-100 text-amber-700' },
  bus:    { icon:'🚌', label:'Buses',    color:'from-rose-50 to-red-50',        border:'border-rose-200',   badge:'bg-rose-100 text-rose-700' },
}

function Bg() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 bg-[#ffffff]" />
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-gradient-radial from-orange-100/40 to-transparent blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-radial from-rose-100/30 to-transparent blur-[90px]" />
    </div>
  )
}

function TransportCard({ option, isSelected, onSelect }) {
  const dep  = option.departure_time ? new Date(option.departure_time) : null
  const arr  = option.arrival_time   ? new Date(option.arrival_time)   : null
  const hrs  = option.duration_mins  ? `${Math.floor(option.duration_mins/60)}h ${option.duration_mins%60}m` : '—'
  const meta = MODE_META[option.mode] || MODE_META.bus

  return (
    <motion.div variants={fadeUp} whileHover={{ scale:1.015, y:-3 }}
      onClick={() => onSelect(option)}
      className={`relative rounded-2xl border backdrop-blur-xl p-5 cursor-pointer transition-all
        bg-white shadow-sm ${isSelected ? meta.border + ' shadow-lg bg-gradient-to-br ' + meta.color : 'border-slate-100 hover:border-slate-200'}
        ${isSelected ? 'ring-1 ring-inset ring-orange-500/10' : ''}`}>
      {isSelected && (
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xs text-white">
          ✓
        </motion.div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-slate-900 font-semibold">{option.provider || 'Unknown Provider'}</p>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${meta.badge}`}>
            {meta.icon} {meta.label}
          </span>
        </div>
        <div className="text-right">
          <p className="text-slate-900 text-xl font-bold">₹{Number(option.price).toLocaleString()}</p>
          {option.comfort_score && (
            <p className="text-amber-500 text-xs">{'⭐'.repeat(option.comfort_score)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-center">
          <p className="text-slate-900 font-bold">{dep ? dep.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '--:--'}</p>
          <p className="text-slate-400 text-[10px]">{dep ? dep.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—'}</p>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1">
          <p className="text-slate-300 text-[10px] font-mono">{hrs}</p>
          <div className="w-full flex items-center gap-1">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs">{meta.icon}</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-slate-900 font-bold">{arr ? arr.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '--:--'}</p>
          <p className="text-slate-400 text-[10px]">{arr ? arr.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—'}</p>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyMode({ icon, label }) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-slate-400 text-sm">No {label.toLowerCase()} options added yet</p>
      <p className="text-slate-300 text-xs mt-1">Add options via Supabase or the API</p>
    </motion.div>
  )
}

// Comparison summary bar
function ComparisonBar({ options }) {
  const all = [...options.flight, ...options.train, ...options.bus].filter(o => o.price)
  if (!all.length) return null

  const cheapest = all.reduce((a,b) => Number(a.price) < Number(b.price) ? a : b)
  const fastest  = all.filter(o => o.duration_mins).reduce((a,b) => a.duration_mins < b.duration_mins ? a : b, all[0])

  return (
    <motion.div variants={fadeUp}
      className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
      {[
        { label:'💰 Cheapest',  val: cheapest ? `₹${Number(cheapest.price).toLocaleString()} · ${MODE_META[cheapest.mode]?.icon} ${cheapest.provider}` : '—' },
        { label:'⚡ Fastest',   val: fastest  ? `${Math.floor(fastest.duration_mins/60)}h${fastest.duration_mins%60}m · ${MODE_META[fastest.mode]?.icon} ${fastest.provider}` : '—' },
        { label:'🛋️ Options',  val: `${all.length} total across all modes` },
      ].map(({ label, val }) => (
        <div key={label}>
          <p className="text-slate-400 text-xs font-mono">{label}</p>
          <p className="text-slate-900 text-sm font-semibold mt-1">{val}</p>
        </div>
      ))}
    </motion.div>
  )
}

export default function Transport() {
  useTripAuth()
  const { activeTrip } = useTrip()
  const { options, loading, error, selected, selectOption } = useTransportData(activeTrip?.id)
  const [activeTab, setActiveTab] = useState('all')

  const tabs = ['all', 'flight', 'train', 'bus']

  const filteredOptions = useMemo(() => {
    if (activeTab === 'all') return options
    return { flight:[], train:[], bus:[], [activeTab]: options[activeTab] }
  }, [activeTab, options])

  return (
    <div className="relative min-h-screen text-slate-900">
      {!activeTrip && (
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <div className="text-center">
            <p className="text-slate-400 text-lg">Loading trip data...</p>
          </div>
        </div>
      )}
      <Bg />
      <div className="max-w-5xl mx-auto px-5 py-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }}>
          <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-1">Module · Transport</p>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">Multi-Modal</span>{' '}
            Transport Engine
          </h1>
          {activeTrip && (
            <p className="text-slate-500 mt-1">
              {activeTrip.origin} <span className="text-slate-300">→</span> {activeTrip.destination}
            </p>
          )}
        </motion.div>

        {!activeTrip ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center">
            <p className="text-4xl mb-3">✈️</p>
            <p className="text-slate-400">Select an active trip from the Dashboard first</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">

            {/* Comparison bar */}
            <ComparisonBar options={options} />

            {/* Selected option banner */}
            <AnimatePresence>
              {selected && (
                <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }}
                  className="flex items-center gap-3 px-5 py-3 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
                  <span className="text-emerald-600 text-xl">✓</span>
                  <div>
                    <p className="text-emerald-700 text-sm font-semibold">Option selected!</p>
                    <p className="text-emerald-600/60 text-xs">{selected.provider} · ₹{Number(selected.price).toLocaleString()}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs */}
            <div className="flex gap-2">
              {tabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all capitalize
                    ${activeTab===tab
                      ? 'bg-orange-500/10 border-orange-400/40 text-orange-600'
                      : 'border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                  {tab === 'all' ? '🌐 All' : `${MODE_META[tab]?.icon} ${MODE_META[tab]?.label}`}
                </button>
              ))}
            </div>

            {loading && (
              <div className="flex items-center justify-center py-16">
                <motion.div className="w-10 h-10 rounded-full border-2 border-slate-100 border-t-orange-500"
                  animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:'linear' }} />
              </div>
            )}

            {error && <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error}</p>}

            {!loading && (
              <div className="space-y-8">
                {(['flight','train','bus']).map(mode => {
                  const list = filteredOptions[mode]
                  if (activeTab !== 'all' && activeTab !== mode) return null
                  const meta = MODE_META[mode]
                  return (
                    <div key={mode}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">{meta.icon}</span>
                        <h2 className="text-slate-800 font-semibold">{meta.label}</h2>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${meta.badge}`}>
                          {list.length} option{list.length!==1?'s':''}
                        </span>
                      </div>
                      {list.length > 0 ? (
                        <motion.div variants={stagger} initial="hidden" animate="visible"
                          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {list.map(opt => (
                            <TransportCard key={opt.id} option={opt}
                              isSelected={selected?.id === opt.id}
                              onSelect={selectOption} />
                          ))}
                        </motion.div>
                      ) : (
                        <EmptyMode icon={meta.icon} label={meta.label} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
