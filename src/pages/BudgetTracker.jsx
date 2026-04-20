import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useTrip } from '../context/TripContext'
import { useTripAuth } from '../hooks/useTripAuth'
import { useBudgetCalc } from '../hooks/useBudgetCalc'
import { db } from '../lib/supabaseClient'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore'

const CATEGORIES = ['food','transport','stay','activity','shopping','other']
const CAT_COLORS = {
  food:'#f97316', transport:'#fbbf24', stay:'#facc15',
  activity:'#ea580c', shopping:'#f87171', other:'#94a3b8',
}
const CAT_ICONS = {
  food:'🍽️', transport:'✈️', stay:'🏨', activity:'🎯', shopping:'🛍️', other:'📦',
}

const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.07 } } }
const fadeUp  = { hidden:{ opacity:0, y:20 }, visible:{ opacity:1, y:0, transition:{ duration:0.4 } } }

function Bg() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 bg-[#ffffff]" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-gradient-radial from-orange-100/40 to-transparent blur-[100px]" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-gradient-radial from-amber-100/40 to-transparent blur-[90px]" />
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-slate-400 text-xs font-mono mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: ₹{Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function BudgetTracker() {
  useTripAuth()
  const { activeTrip } = useTrip()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading]   = useState(false)
  const [form, setForm]         = useState({ title:'', amount:'', category:'food', paid_at: new Date().toISOString().split('T')[0] })
  const [adding, setAdding]     = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [chartTab, setChartTab] = useState('area')

  // Set up real-time listener for expenses
  useEffect(() => {
    if (!activeTrip) {
      setExpenses([])
      return
    }

    let isMounted = true
    setLoading(true)
    
    try {
      const q = query(
        collection(db, 'expenses'),
        where('trip_id', '==', activeTrip.id)
      )

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return
          
          // Deduplicate by creating a Map with expense IDs as keys
          const expensesMap = new Map()
          snapshot.docs.forEach(d => {
            const data = { id: d.id, ...d.data() }
            expensesMap.set(d.id, data)
          })
          
          const data = Array.from(expensesMap.values())
          // Sort by paid_at in JavaScript
          data.sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at))
          console.log('Expenses updated:', data)
          setExpenses(data)
          setLoading(false)
        },
        (error) => {
          if (!isMounted) return
          console.error('Error listening to expenses:', error)
          setLoading(false)
        }
      )

      return () => {
        isMounted = false
        unsubscribe()
      }
    } catch (error) {
      if (isMounted) {
        console.error('Error setting up expenses listener:', error)
        setLoading(false)
      }
    }
  }, [activeTrip])

  // Heavy calculations memoised — won't recalculate on unrelated re-renders
  const summary = useBudgetCalc(expenses, activeTrip?.total_budget ?? 0)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!activeTrip) return
    setAdding(true)
    try {
      await addDoc(collection(db, 'expenses'), {
        ...form,
        amount: Number(form.amount),
        trip_id: activeTrip.id,
        created_at: new Date()
      })
      // Don't manually add to state - let the listener handle it
      setForm({ title:'', amount:'', category:'food', paid_at: new Date().toISOString().split('T')[0] })
      setShowForm(false)
    } catch (error) {
      console.error('Error adding expense:', error)
    }
    setAdding(false)
    setShowForm(false)
  }

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'expenses', id))
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch (error) {
      console.error('Error deleting expense:', error)
    }
  }

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
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} className="flex items-end justify-between">
          <div>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-1">Module · Budget</p>
            <h1 className="text-3xl font-bold">
              <span className="bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">Burn Rate</span>{' '}
              Tracker
            </h1>
          </div>
          <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }} onClick={() => setShowForm(v=>!v)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold text-sm shadow-lg shadow-orange-500/25">
            + Add Expense
          </motion.button>
        </motion.div>

        {!activeTrip ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center">
            <p className="text-4xl mb-3">💸</p>
            <p className="text-slate-400">Select an active trip from the Dashboard first</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">

            {/* Add expense form */}
            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  className="overflow-hidden">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/50 backdrop-blur-xl p-6 shadow-xl">
                    <h3 className="text-slate-800 font-semibold mb-4">Add Expense</h3>
                    <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider block mb-1.5">Title</label>
                        <input required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                          placeholder="e.g. Dinner" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm placeholder-slate-300 focus:outline-none focus:border-orange-500/50 transition-all" />
                      </div>
                      <div>
                        <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider block mb-1.5">Amount (₹)</label>
                        <input required type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
                          placeholder="500" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm placeholder-slate-300 focus:outline-none focus:border-orange-500/50 transition-all" />
                      </div>
                      <div>
                        <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider block mb-1.5">Category</label>
                        <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-orange-500/50 transition-all capitalize">
                          {CATEGORIES.map(c => <option key={c} value={c} className="bg-white">{CAT_ICONS[c]} {c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider block mb-1.5">Date</label>
                        <input type="date" value={form.paid_at} onChange={e=>setForm(f=>({...f,paid_at:e.target.value}))}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-orange-500/50 transition-all" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-4 flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl border border-slate-200 text-slate-400 text-sm hover:text-slate-600 transition-colors">Cancel</button>
                        <motion.button type="submit" disabled={adding} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                          className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold text-sm disabled:opacity-60">
                          {adding ? 'Adding…' : 'Add Expense'}
                        </motion.button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Summary tiles */}
            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label:'Total Budget', val:`₹${(activeTrip.total_budget??0).toLocaleString()}`, col:'text-slate-700',   bg:'bg-slate-50' },
                { label:'Total Spent',  val:`₹${summary.totalSpent.toLocaleString()}`,           col:'text-orange-600',  bg:'bg-orange-50' },
                { label:'Remaining',    val:`₹${summary.remaining.toLocaleString()}`,            col:'text-emerald-600', bg:'bg-emerald-50' },
                { label:'Burn Rate',    val:`${summary.burnPct}%`,                               col: summary.isOverBudget?'text-rose-600':'text-amber-600', bg:'bg-amber-50' },
              ].map(({ label, val, col, bg }) => (
                <motion.div key={label} variants={fadeUp}
                  className={`rounded-2xl border border-slate-200 ${bg} p-5 shadow-sm`}>
                  <p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${col}`}>{val}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Burn progress bar */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-slate-500">Budget utilisation</span>
                <span className={summary.isOverBudget ? 'text-rose-600 font-bold' : 'text-slate-700'}>{summary.burnPct}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div className={`h-full rounded-full ${summary.burnPct > 80
                  ? 'bg-gradient-to-r from-orange-500 to-rose-500'
                  : 'bg-gradient-to-r from-orange-400 to-amber-500'}`}
                  initial={{ width:0 }} animate={{ width:`${Math.min(summary.burnPct,100)}%` }}
                  transition={{ duration:1.5, ease:'easeOut' }} />
              </div>
              {summary.isOverBudget && (
                <p className="text-rose-600 text-xs mt-2">⚠️ Over budget by ₹{Math.abs(summary.remaining).toLocaleString()}</p>
              )}
            </motion.div>

            {/* Charts */}
            {summary.timeSeriesData.length > 0 && (
              <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white font-semibold">Spending Over Time</h2>
                  <div className="flex gap-2">
                    {['area','bar'].map(t => (
                      <button key={t} onClick={() => setChartTab(t)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono capitalize border transition-all
                          ${chartTab===t ? 'bg-white/10 border-white/25 text-white' : 'border-white/8 text-white/35 hover:text-white/65'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  {chartTab === 'area' ? (
                    <AreaChart data={summary.timeSeriesData}>
                      <defs>
                        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f97316" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill:'rgba(15,23,42,0.3)', fontSize:11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill:'rgba(15,23,42,0.3)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="cumulative" name="Cumulative" stroke="#f97316" strokeWidth={2} fill="url(#cg)" />
                      <Area type="monotone" dataKey="daily" name="Daily" stroke="#fbbf24" strokeWidth={2} fill="none" strokeDasharray="4 2" />
                    </AreaChart>
                  ) : (
                    <BarChart data={summary.timeSeriesData}>
                      <XAxis dataKey="date" tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="daily" name="Daily Spend" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Category pie + list */}
            {summary.categoryData.length > 0 && (
              <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                  <h2 className="text-white font-semibold mb-4">By Category</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={summary.categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                        paddingAngle={3} dataKey="value">
                        {summary.categoryData.map((entry, i) => (
                          <Cell key={i} fill={CAT_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, '']} contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:12, boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)' }} itemStyle={{ color:'#1e293b' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
                  <h2 className="text-white font-semibold mb-4">Category Breakdown</h2>
                  <div className="space-y-3">
                    {summary.categoryData.sort((a,b)=>b.value-a.value).map(({ name, value }) => {
                      const pct = summary.totalSpent > 0 ? (value/summary.totalSpent)*100 : 0
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/60 capitalize">{CAT_ICONS[name]} {name}</span>
                            <span className="text-white/80">₹{value.toLocaleString()} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div style={{ background: CAT_COLORS[name] || '#94a3b8' }}
                              className="h-full rounded-full"
                              initial={{ width:0 }} animate={{ width:`${pct}%` }}
                              transition={{ duration:1, ease:'easeOut' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Expense list */}
            <motion.div variants={fadeUp} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
              <div className="p-5 border-b border-white/8 flex items-center justify-between">
                <h2 className="text-white font-semibold">All Expenses</h2>
                <span className="text-white/35 text-xs font-mono">{expenses.length} entries</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-amber-400"
                    animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:'linear' }} />
                </div>
              ) : expenses.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-3xl mb-2">💸</p>
                  <p className="text-white/30 text-sm">No expenses yet. Add your first one above!</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {[...expenses].reverse().map(exp => (
                    <motion.div key={exp.id} layout
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{CAT_ICONS[exp.category]}</span>
                        <div>
                          <p className="text-slate-800 text-sm font-medium">{exp.title}</p>
                          <p className="text-slate-400 text-xs capitalize">{exp.category} · {exp.paid_at}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-slate-800 font-semibold">₹{Number(exp.amount).toLocaleString()}</p>
                        <button onClick={() => handleDelete(exp.id)}
                          className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 text-sm transition-all">✕</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

          </motion.div>
        )}
      </div>
    </div>
  )
}
