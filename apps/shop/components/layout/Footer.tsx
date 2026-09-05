import Link from 'next/link'
import { Mail, MapPin, Phone, ShieldCheck, Truck, Wallet, Headphones } from 'lucide-react'
import { MaideresLogo } from '@/components/ui/BrandLogo'

export function Footer() {
  const whatsapp = '237695884528'

  return (
    <footer className="bg-[#1B1F2A] text-white">
      <div className="border-y border-gray-200 bg-white text-brand-ink">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { icon: Truck, title: 'Livraison rapide', text: 'Partout au Cameroun' },
            { icon: Wallet, title: 'Paiement securise', text: '100% securise' },
            { icon: ShieldCheck, title: 'Produits garantis', text: 'Certifies et testes' },
            { icon: Headphones, title: 'Support client', text: 'Lun - Sam : 7h30 - 18h' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3">
              <Icon size={25} className="text-brand-indigo" />
              <div>
                <p className="text-sm font-black">{title}</p>
                <p className="text-xs text-gray-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.2fr]">
          <div>
            <MaideresLogo size={30} variant="white" />
            <p className="mt-4 max-w-xs text-sm leading-6 text-gray-400">
              MAIDERES connecte vos besoins du quotidien avec des prestataires de confiance à Douala.
            </p>
            <div className="mt-5 flex gap-2">
              {['f', 'ig', 'wa', 'in'].map((item) => (
                <span key={item} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white">{item}</span>
              ))}
            </div>
          </div>

          <FooterColumn title="Navigation" links={[
            ['Suivre ma demande', '/suivi'],
            ['Mon compte', '/compte/login'],
          ]} />

          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-wider text-gray-300">Contact</p>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-gold" /> Douala, Cameroun</li>
              <li className="flex gap-2"><Phone size={16} className="shrink-0 text-brand-gold" /> +237 695884528</li>
              <li className="flex gap-2"><Mail size={16} className="shrink-0 text-brand-gold" /> contact@maideres.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} MAIDERES. Tous droits reserves.</p>
        </div>
      </div>

      <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="fixed bottom-4 right-4 z-40 rounded-full bg-green-600 px-4 py-2 text-sm font-black text-white shadow-lg hover:bg-green-700">
        WhatsApp
      </a>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="mb-4 text-sm font-black uppercase tracking-wider text-gray-300">{title}</p>
      <ul className="space-y-2 text-sm text-gray-400">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="transition-colors hover:text-white">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
