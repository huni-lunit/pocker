'use client'

import React from 'react'
import { ConnectionStatus as Status } from '@/lib/realtime'

interface ConnectionStatusProps {
  status: Status
  className?: string
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  status, 
  className = '' 
}) => {
  const getStatusConfig = (status: Status) => {
    switch (status) {
      case 'connected':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: '🟢',
          text: 'Connected'
        }
      case 'connecting':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          icon: '🟡',
          text: 'Connecting...'
        }
      case 'disconnected':
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: '⚫',
          text: 'Disconnected'
        }
      case 'error':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: '🔴',
          text: 'Connection Error'
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.text}
    </div>
  )
} 