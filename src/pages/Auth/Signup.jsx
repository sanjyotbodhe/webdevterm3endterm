import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'

export default function Signup() {
  const { signUp }  = useAuth()
  const navigate    = useNavigate()
  const [form, setForm]       = useState({ username: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await signUp(form.email, form.password, form.username)
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setTimeout(() => navigate('/dashboard', { replace: true }), 1500) }
  }

  if (success) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-slate-900 text-2xl font-bold">Welcome aboard!</h2>
        <p className="text-slate-400 mt-2">Redirecting to your dashboard…</p>
      </motion.div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 relative overflow-hidden">
      <motion.div animate={{ x: [0,40,0], y: [0,30,0] }} transition={{ duration: 15, repeat: Infinity }}
        className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-radial from-orange-200/40 to-transparent blur-[80px]" />
      <motion.div animate={{ x: [0,-30,0], y: [0,40,0] }} transition={{ duration: 20, repeat: Infinity, delay: 5 }}
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-radial from-amber-200/30 to-transparent blur-[80px]" />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg shadow-orange-500/20">
            🌍
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">Start your stress-free travel journey</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { key: 'username', label: 'Username', type: 'text',     placeholder: 'your_username' },
              { key: 'email',    label: 'Email',    type: 'email',    placeholder: 'you@example.com' },
              { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="text-slate-500 text-xs font-mono uppercase tracking-wider block mb-2">{label}</label>
                <input
                  type={type} required
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400
                             focus:outline-none focus:border-orange-500/50 focus:bg-white transition-all text-sm"
                />
              </div>
            ))}

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-rose-600 text-sm bg-rose-50 border border-rose-100 rounded-xl px-4 py-2">
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit" disabled={loading}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold
                         shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-600 hover:text-orange-500 font-medium transition-colors">Sign in →</Link>
        </p>
      </motion.div>
    </div>
  )
}
