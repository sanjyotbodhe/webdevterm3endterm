import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-900 px-4">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="text-center">
        <motion.div className="text-8xl mb-6" animate={{ rotate:[0,10,-10,0] }} transition={{ duration:3, repeat:Infinity }}>
          🌍
        </motion.div>
        <h1 className="text-6xl font-bold bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent mb-4">404</h1>
        <p className="text-slate-400 text-lg mb-8">Looks like this destination doesn't exist</p>
        <Link to="/dashboard">
          <motion.span whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
            className="inline-block px-8 py-3 rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold shadow-lg shadow-orange-500/20">
            Back to Dashboard →
          </motion.span>
        </Link>
      </motion.div>
    </div>
  )
}
