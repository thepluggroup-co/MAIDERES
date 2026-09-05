import React from 'react'

export interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E4EAF4] text-[#254C8C] mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#1F2430] mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
