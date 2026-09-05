import React from 'react'
import { motion } from 'framer-motion'
import { PageHeader, EmptyState } from '@maideres/ui'
import { Construction } from 'lucide-react'

interface ModulePageProps {
  title: string
  subtitle?: string
}

export default function ModulePage({ title, subtitle }: ModulePageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <PageHeader
        title={title}
        subtitle={subtitle ?? `Module ${title} — à venir`}
        breadcrumbs={[{ label: 'MAIDERES', href: '/' }, { label: title }]}
      />
      <EmptyState
        icon={<Construction className="h-8 w-8" />}
        title="Module en cours de développement"
        description="Ce module sera disponible dans une prochaine version de la Console MAIDERES."
      />
    </motion.div>
  )
}
