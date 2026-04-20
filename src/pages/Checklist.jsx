import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTrip } from '../context/TripContext'
import { useTripAuth } from '../hooks/useTripAuth'
import { db, storage } from '../lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const CATEGORIES = ['clothing','documents','toiletries','electronics','medicine','other']
const CAT_ICONS  = { clothing:'👕', documents:'📄', toiletries:'🧴', electronics:'🔌', medicine:'💊', other:'📦' }

const stagger = { hidden:{}, visible:{ transition:{ staggerChildren:0.06 } } }
const fadeUp  = { hidden:{ opacity:0, y:16 }, visible:{ opacity:1, y:0, transition:{ duration:0.35 } } }

// Simulated weather-based auto-suggestions
const WEATHER_SUGGESTIONS = {
  hot:   ['Sunscreen SPF 50', 'Sunglasses', 'Light cotton shirts', 'Hat/cap', 'Flip flops', 'Electrolyte sachets'],
  cold:  ['Heavy jacket', 'Thermal innerwear', 'Woollen socks', 'Gloves', 'Hand warmers', 'Moisturiser'],
  rainy: ['Raincoat/Poncho', 'Waterproof shoes', 'Quick-dry towel', 'Plastic bags', 'Umbrella', 'Waterproof bag cover'],
  beach: ['Swimwear', 'Beach towel', 'Waterproof sunscreen', 'Snorkelling gear', 'Dry bag', 'Reef-safe sunscreen'],
}

function Bg() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none">
      <div className="absolute inset-0 bg-[#ffffff]" />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-radial from-orange-100/40 to-transparent blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-radial from-amber-100/30 to-transparent blur-[90px]" />
    </div>
  )
}

function CheckItem({ item, onToggle, onDelete }) {
  return (
    <motion.div variants={fadeUp} layout
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors group">
      <button onClick={() => onToggle(item)} className="shrink-0">
        <motion.div whileTap={{ scale:0.85 }}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
            ${item.is_checked ? 'bg-orange-500 border-orange-500' : 'border-slate-200 hover:border-orange-500/60'}`}>
          {item.is_checked && <span className="text-white text-xs font-bold">✓</span>}
        </motion.div>
      </button>
      <span className={`flex-1 text-sm transition-all ${item.is_checked ? 'line-through text-slate-300' : 'text-slate-700'}`}>
        {item.label}
      </span>
      {item.is_auto && (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-300">AI</span>
      )}
      <button onClick={() => onDelete(item)}
        className="opacity-0 group-hover:opacity-100 text-rose-400/50 hover:text-rose-400 text-xs transition-all">✕</button>
    </motion.div>
  )
}

function DocVaultItem({ doc, onDelete }) {
  return (
    <motion.div variants={fadeUp} layout
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 hover:border-orange-100 hover:bg-orange-50/30 transition-all group shadow-sm">
      <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-base shrink-0">
        📄
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 text-sm font-medium truncate">{doc.label || doc.filename}</p>
        <p className="text-slate-400 text-xs">{doc.filename} · {doc.file_size ? `${(doc.file_size/1024).toFixed(1)} KB` : 'Unknown size'}</p>
      </div>
      <div className="flex items-center gap-2">
        <a href={doc.url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors opacity-0 group-hover:opacity-100">
          View →
        </a>
        <button onClick={() => onDelete(doc.id)} className="text-rose-400/50 hover:text-rose-600 text-xs transition-all opacity-0 group-hover:opacity-100">✕</button>
      </div>
    </motion.div>
  )
}

export default function Checklist() {
  useTripAuth()
  const { activeTrip } = useTrip()
  const [persistentItems, setPersistentItems] = useState([]) // From checklist_items
  const [customItems, setCustomItems]         = useState([]) // From custom_checklist_items
  const [suggestedItems, setSuggestedItems]   = useState([]) // Local state weather hints
  const [docs, setDocs]                       = useState([])
  const [loading, setLoading]                 = useState(false)
  const [newItem, setNewItem]                 = useState('')
  const [newCat, setNewCat]                   = useState('other')
  const [activeTab, setActiveTab]             = useState('checklist')
  const [docLabel, setDocLabel]               = useState('')
  const [uploading, setUploading]             = useState(false)
  const [weatherMode, setWeatherMode]         = useState(null)
  const [adding, setAdding]                   = useState(false)
  const [weatherProcessing, setWeatherProcessing] = useState(false)

  const fileInputRef = useRef(null)

  // Merged items list for the UI
  const items = useMemo(() => {
    // Flag persistentItems as 'packed' and customItems as 'custom'
    const packed = persistentItems.map(i => ({ ...i, origin: 'packed', is_auto: true }))
    const custom = customItems.map(i => ({ ...i, origin: 'custom', is_auto: false }))
    const suggestions = suggestedItems.map((label, idx) => ({
      id: `suggest-${idx}`,
      label,
      category: 'clothing',
      is_checked: false,
      is_auto: true,
      origin: 'suggestion'
    }))
    
    return [...packed, ...custom, ...suggestions]
  }, [persistentItems, customItems, suggestedItems])

  useEffect(() => {
    if (!activeTrip) {
      setPersistentItems([])
      setCustomItems([])
      setDocs([])
      return
    }

    let isMounted = true
    setLoading(true)

    try {
      const unsubscribePacked = onSnapshot(
        query(collection(db, 'checklist_items'), where('trip_id', '==', activeTrip.id)),
        (cSnap) => {
          if (!isMounted) return
          setPersistentItems(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        },
        (error) => console.error('Error listening to checklist items:', error)
      )

      const unsubscribeCustom = onSnapshot(
        query(collection(db, 'custom_checklist_items'), where('trip_id', '==', activeTrip.id)),
        (cSnap) => {
          if (!isMounted) return
          setCustomItems(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
          setLoading(false)
        },
        (error) => {
          console.error('Error listening to custom items:', error)
          setLoading(false)
        }
      )

      const unsubscribeDocs = onSnapshot(
        query(collection(db, 'documents'), where('trip_id', '==', activeTrip.id)),
        (dSnap) => {
          if (!isMounted) return
          setDocs(dSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        },
        (error) => console.error('Error listening to documents:', error)
      )

      return () => {
        isMounted = false
        unsubscribePacked()
        unsubscribeCustom()
        unsubscribeDocs()
      }
    } catch (error) {
      if (isMounted) {
        console.error('Error setting up listeners:', error)
        setLoading(false)
      }
    }
  }, [activeTrip])

  const addItem = async (e) => {
    e?.preventDefault()
    if (!newItem.trim() || !activeTrip || adding) return
    setAdding(true)
    try {
      await addDoc(collection(db, 'custom_checklist_items'), {
        label: newItem.trim(),
        category: newCat,
        trip_id: activeTrip.id,
        is_checked: false,
        created_at: new Date().toISOString()
      })
      setNewItem('')
      setNewCat('other')
    } catch (error) {
      console.error('Error adding custom item:', error)
    }
    setAdding(false)
  }

  const toggleItem = async (item) => {
    try {
      if (item.origin === 'suggestion') {
        // Move from local suggestions to DB as 'packed'
        await addDoc(collection(db, 'checklist_items'), {
          label: item.label,
          category: item.category,
          trip_id: activeTrip.id,
          is_checked: true,
          is_suggestion: true,
          created_at: new Date().toISOString()
        })
        setSuggestedItems(prev => prev.filter(l => l !== item.label))
      } else if (item.origin === 'custom') {
        await updateDoc(doc(db, 'custom_checklist_items', item.id), { is_checked: !item.is_checked })
      } else if (item.origin === 'packed') {
        if (item.is_suggestion && item.is_checked) {
          // Unpacking a suggestion -> remove from DB, return to local list
          await deleteDoc(doc(db, 'checklist_items', item.id))
          setSuggestedItems(prev => [...prev, item.label])
        } else {
          await updateDoc(doc(db, 'checklist_items', item.id), { is_checked: !item.is_checked })
        }
      }
    } catch (error) {
      console.error('Error toggling item:', error)
    }
  }

  const deleteItem = async (item) => {
    try {
      if (item.origin === 'suggestion') {
        setSuggestedItems(prev => prev.filter(l => l !== item.label))
      } else if (item.origin === 'custom') {
        await deleteDoc(doc(db, 'custom_checklist_items', item.id))
      } else if (item.origin === 'packed') {
        await deleteDoc(doc(db, 'checklist_items', item.id))
      }
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  const addWeatherItems = (mode) => {
    if (!activeTrip) return
    
    if (weatherMode === mode) {
      setWeatherMode(null)
      setSuggestedItems([])
      return
    }

    setWeatherMode(mode)
    const suggestions = WEATHER_SUGGESTIONS[mode] || []
    
    // Filter out items already in DB
    const existingLabels = [...persistentItems, ...customItems].map(i => i.label.toLowerCase())
    const newSuggestions = suggestions.filter(s => !existingLabels.includes(s.toLowerCase()))
    
    setSuggestedItems(newSuggestions)
  }

  const handleFileUpload = async (file) => {
    if (!file || !activeTrip) return
    setUploading(true)

    try {
      const path = `documents/${activeTrip.id}/${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)

      await addDoc(collection(db, 'documents'), {
        trip_id: activeTrip.id,
        user_id: activeTrip.user_id,
        filename: file.name,
        storage_path: path,
        file_type: file.type,
        file_size: file.size,
        label: docLabel || file.name,
        url,
        uploaded_at: new Date().toISOString()
      })

      setDocLabel('')
    } catch (error) {
      console.error('Error uploading file:', error)
    }
    setUploading(false)
  }

  const deleteDocument = async (id) => {
    try {
      await deleteDoc(doc(db, 'documents', id))
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat)
    return acc
  }, {})

  const checkedCount = items.filter(i => i.is_checked).length
  const progress     = items.length > 0 ? (checkedCount / items.length) * 100 : 0

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
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }}>
          <p className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-1">Module · Checklist</p>
          <h1 className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">Smart</span>{' '}
            Checklist & Vault
          </h1>
        </motion.div>

        {!activeTrip ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-slate-400">Select an active trip from the Dashboard first</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">

            {/* Tabs */}
            <motion.div variants={fadeUp} className="flex gap-2">
              {[['checklist','📋 Packing List'], ['vault','🔐 Document Vault']].map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-full text-sm font-medium border transition-all
                    ${activeTab===tab ? 'bg-orange-500/10 border-orange-400/40 text-orange-600' : 'border-slate-100 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </motion.div>

            {/* ── CHECKLIST TAB ── */}
            {activeTab === 'checklist' && (
              <>
                {/* Progress */}
                <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex justify-between mb-3">
                    <p className="text-slate-800 font-semibold">Packing Progress</p>
                    <p className="text-slate-400 text-sm">{checkedCount} / {items.length} items</p>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                      initial={{ width:0 }} animate={{ width:`${progress}%` }}
                      transition={{ duration:1, ease:'easeOut' }} />
                  </div>
                  {progress === 100 && items.length > 0 && (
                    <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} className="text-emerald-600 text-sm mt-2">
                      🎉 All packed! Ready to go!
                    </motion.p>
                  )}
                </motion.div>

                {/* Weather suggestions */}
                <motion.div variants={fadeUp} className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5">
                  <p className="text-amber-800 text-sm font-semibold mb-3">🌤️ Weather-Aware Suggestions</p>
                  <p className="text-amber-600/75 text-xs mb-4">Select destination weather to see packing hints (Hints only save when checked)</p>
                  <div className="flex flex-wrap gap-2">
                    {[['hot','☀️ Hot'],['cold','❄️ Cold'],['rainy','🌧️ Rainy'],['beach','🏖️ Beach']].map(([mode, label]) => (
                      <motion.button key={mode} whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
                        onClick={() => addWeatherItems(mode)}
                        disabled={weatherProcessing}
                        className={`px-4 py-2 rounded-full text-sm border transition-all ${weatherProcessing ? 'opacity-50 cursor-wait' : ''}
                          ${weatherMode===mode ? 'bg-amber-500/10 border-amber-400 text-amber-700' : 'border-amber-200 text-amber-600 hover:border-amber-400 hover:text-amber-800'}`}>
                        {label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* Add item */}
                <motion.div variants={fadeUp}>
                  <form onSubmit={addItem} className="flex gap-3">
                    <input value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="Add a new item…"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500/50 transition-all" />
                    <select value={newCat} onChange={e=>setNewCat(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-orange-500/50 transition-all">
                      {CATEGORIES.map(c => <option key={c} value={c} className="bg-white capitalize">{CAT_ICONS[c]} {c}</option>)}
                    </select>
                    <motion.button type="submit" disabled={!newItem.trim()||adding} whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold text-sm disabled:opacity-50">
                      Add
                    </motion.button>
                  </form>
                </motion.div>

                {/* Category groups */}
                {loading ? (
                  <div className="flex justify-center py-12">
                    <motion.div className="w-8 h-8 rounded-full border-2 border-slate-100 border-t-orange-500"
                      animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:'linear' }} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {CATEGORIES.map(cat => {
                      const catItems = grouped[cat]
                      if (!catItems.length) return null
                      return (
                        <motion.div key={cat} variants={fadeUp}
                          className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                            <span>{CAT_ICONS[cat]}</span>
                            <h3 className="text-slate-800 font-medium text-sm capitalize">{cat}</h3>
                            <span className="text-slate-400 text-xs ml-auto">
                              {catItems.filter(i=>i.is_checked).length}/{catItems.length}
                            </span>
                          </div>
                          <AnimatePresence mode="popLayout">
                            {catItems.map(item => (
                              <CheckItem key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
                            ))}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── VAULT TAB ── */}
            {activeTab === 'vault' && (
              <>
                {/* Custom upload UI using useRef */}
                <motion.div variants={fadeUp}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
                  <div>
                    <h3 className="text-slate-800 font-semibold mb-1">Upload Document</h3>
                    <p className="text-slate-400 text-sm">Securely store passports, tickets, insurance docs & more</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]) }}
                  />
                  <input value={docLabel} onChange={e=>setDocLabel(e.target.value)}
                    placeholder="Document label (e.g. Passport, Flight Ticket)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500/50 transition-all" />

                  {/* Custom drop zone — triggered by useRef */}
                  <motion.div
                    whileHover={{ borderColor:'rgba(249,115,22,0.4)', backgroundColor:'rgba(249,115,22,0.02)' }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer transition-all">
                    {uploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <motion.div className="w-8 h-8 rounded-full border-2 border-slate-100 border-t-orange-500"
                          animate={{ rotate:360 }} transition={{ duration:0.8, repeat:Infinity, ease:'linear' }} />
                        <p className="text-slate-400 text-sm">Uploading…</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-3xl mb-2">📤</p>
                        <p className="text-slate-500 text-sm">Click or drag & drop a file here</p>
                        <p className="text-slate-400 text-xs mt-1">PDF, JPG, PNG up to 10MB</p>
                      </>
                    )}
                  </motion.div>
                </motion.div>

                {/* Document list */}
                <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-slate-800 font-semibold">Stored Documents</h2>
                    <span className="text-slate-400 text-xs font-mono">{docs.length} files</span>
                  </div>
                  {docs.length === 0 ? (
                    <div className="p-12 text-center">
                      <p className="text-3xl mb-2">🔐</p>
                      <p className="text-slate-400 text-sm">No documents uploaded yet</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-2">
                      <AnimatePresence>
                        {docs.map(doc => <DocVaultItem key={doc.id} doc={doc} onDelete={deleteDocument} />)}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              </>
            )}

          </motion.div>
        )}
      </div>
    </div>
  )
}
