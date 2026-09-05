import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { MaideresLogoHero } from '@/components/ui/Logo'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(email.trim(), password)

    if (error) {
      console.error('[Login] Supabase error:', error)
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #1B3357 0%, #0E1420 100%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-10">
          <MaideresLogoHero variant="white" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="vous@maideres.com"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30
                border border-white/10 bg-white/5 focus:outline-none focus:ring-2
                focus:ring-[#8FA8D6] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30
                border border-white/10 bg-white/5 focus:outline-none focus:ring-2
                focus:ring-[#8FA8D6] focus:border-transparent transition-all"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-center px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(163,45,45,0.25)', color: '#F0A8A8' }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all
              focus:outline-none focus:ring-2 focus:ring-[#F2A93B] focus:ring-offset-2
              focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#F2A93B', color: '#4A2F06' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#E09A2E' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F2A93B' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connexion...
              </span>
            ) : 'Se connecter'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          MAIDERES · Console opérations · © MAIDERES 2026
        </p>
      </motion.div>
    </div>
  )
}
