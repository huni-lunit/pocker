'use client'

import React, { useState } from 'react'
import { Modal, Button, Input, Dropdown, Toggle } from '@/components/ui'
import { useGameStore } from '@/lib/store'
import { VotingSystem, VOTING_SYSTEMS } from '@/types'

interface GameSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export const GameSettings: React.FC<GameSettingsProps> = ({ isOpen, onClose }) => {
  const {
    session,
    currentUserId,
    updateGameSettings
  } = useGameStore()

  const [localSessionName, setLocalSessionName] = useState(session?.name || '')
  const [localVotingSystem, setLocalVotingSystem] = useState<VotingSystem>(session?.votingSystem || 'simple')
  const [localFacilitator, setLocalFacilitator] = useState(session?.facilitator || '')
  const [localSettings, setLocalSettings] = useState(session?.settings || {
    autoReveal: false,
    showAverage: true,
    showCountdown: true,
    enableFunFeatures: true,
    whoCanReveal: 'everyone' as const,
    whoCanManageIssues: 'everyone' as const
  })

  if (!session || !currentUserId) return null

  const playerOptions = session.players.map(player => ({
    value: player.id,
    label: player.name
  }))

  const votingSystemOptions = [
    { value: 'simple', label: 'Simple (1, 2, 3, 4, 5)' },
    { value: 'extended', label: 'Extended (0, 1, 2, 3, 4, 5, 6)' }
  ]

  const permissionOptions = [
    { value: 'everyone', label: 'All players' },
    { value: 'facilitator', label: 'Facilitator only' }
  ]

  const handleSave = () => {
    if (!session) return

    // Update all settings at once for synchronization
    updateGameSettings(
      localSettings,
      localFacilitator !== session.facilitator ? localFacilitator : undefined,
      localSessionName !== session.name ? localSessionName : undefined,
      localVotingSystem !== session.votingSystem ? localVotingSystem : undefined
    )
    
    onClose()
  }

  const handleReset = () => {
    setLocalSessionName(session.name)
    setLocalVotingSystem(session.votingSystem)
    setLocalFacilitator(session.facilitator)
    setLocalSettings(session.settings)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Game Settings"
      size="lg"
    >
      <div className="space-y-6">
        {/* Game Facilitator */}
        <div>
          <Dropdown
            label="Game Facilitator"
            options={playerOptions}
            value={localFacilitator}
            onChange={setLocalFacilitator}
          />
        </div>

        {/* Game Name */}
        <div>
          <Input
            label="Game's Name"
            value={localSessionName}
            onChange={(e) => setLocalSessionName(e.target.value)}
            placeholder="Enter session name"
          />
        </div>

        {/* Voting System */}
        <div>
          <Dropdown
            label="Voting System"
            options={votingSystemOptions}
            value={localVotingSystem}
            onChange={(value) => setLocalVotingSystem(value as VotingSystem)}
          />
          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Current cards: [{VOTING_SYSTEMS[localVotingSystem].join(', ')}]
            </p>
          </div>
        </div>

        {/* Manage Custom Decks */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voting System Options
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="text-blue-600 border-blue-300"
          >
            Manage Custom Decks
          </Button>
          <p className="text-xs text-gray-500 mt-1">
            Custom deck management will be available in a future update
          </p>
        </div>

        {/* Who Can Reveal Cards */}
        <div>
          <Dropdown
            label="Who Can Reveal Cards"
            options={permissionOptions}
            value={localSettings.whoCanReveal === 'everyone' ? 'everyone' : 'facilitator'}
            onChange={(value) => setLocalSettings({
              ...localSettings,
              whoCanReveal: value as 'everyone' | 'facilitator'
            })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Players who are allowed to flip cards and show results
          </p>
        </div>

        {/* Who Can Manage Issues */}
        <div>
          <Dropdown
            label="Who Can Manage Issues"
            options={permissionOptions}
            value={localSettings.whoCanManageIssues === 'everyone' ? 'everyone' : 'facilitator'}
            onChange={(value) => setLocalSettings({
              ...localSettings,
              whoCanManageIssues: value as 'everyone' | 'facilitator'
            })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Players who are allowed to create, delete and edit issues in the sidebar
          </p>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Features</h4>
          
          <Toggle
            checked={localSettings.autoReveal}
            onChange={(checked) => setLocalSettings({
              ...localSettings,
              autoReveal: checked
            })}
            label="Auto-reveal cards"
          />
          <p className="text-xs text-gray-500 -mt-2 ml-14">
            Show cards automatically after everyone voted
          </p>

          <Toggle
            checked={localSettings.enableFunFeatures}
            onChange={(checked) => setLocalSettings({
              ...localSettings,
              enableFunFeatures: checked
            })}
            label="Enable fun features"
          />
          <p className="text-xs text-gray-500 -mt-2 ml-14">
            Allow players throw projectiles to each other in this game
          </p>

          <Toggle
            checked={localSettings.showAverage}
            onChange={(checked) => setLocalSettings({
              ...localSettings,
              showAverage: checked
            })}
            label="Show average in the results"
          />
          <p className="text-xs text-gray-500 -mt-2 ml-14">
            Include the average value in the results of the voting
          </p>

          <Toggle
            checked={localSettings.showCountdown}
            onChange={(checked) => setLocalSettings({
              ...localSettings,
              showCountdown: checked
            })}
            label="Show countdown animation"
          />
          <p className="text-xs text-gray-500 -mt-2 ml-14">
            A countdown is shown when revealing cards to ensure last-second votes are recorded
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="secondary"
            onClick={handleReset}
          >
            Reset
          </Button>
          <div className="space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
} 