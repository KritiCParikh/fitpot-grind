import { useState } from 'react'
import Icon from './Icon'

export default function BottomTabs({ onTabChange, activeTab = 'locker' }) {
  const [tab, setTab] = useState(activeTab)

  const handleTabChange = (newTab) => {
    setTab(newTab)
    if (onTabChange) onTabChange(newTab)
  }

  return (
    <div className="bottom-tabs">
      <button
        className={`tab-btn ${tab === 'locker' ? 'active' : ''}`}
        onClick={() => handleTabChange('locker')}
        aria-label="Locker"
      >
        <Icon name="me" size={24} />
        <span>Locker</span>
      </button>
      <button
        className={`tab-btn ${tab === 'crew' ? 'active' : ''}`}
        onClick={() => handleTabChange('crew')}
        aria-label="Crew"
      >
        <Icon name="group" size={24} />
        <span>Crew</span>
      </button>
      <button
        className={`tab-btn ${tab === 'coach' ? 'active' : ''}`}
        disabled
        aria-label="Coach (coming soon)"
        title="Being built"
      >
        <Icon name="spark" size={24} />
        <span>Coach</span>
      </button>
      <button
        className={`tab-btn ${tab === 'account' ? 'active' : ''}`}
        onClick={() => handleTabChange('account')}
        aria-label="Account"
      >
        <Icon name="account" size={24} />
        <span>Account</span>
      </button>
    </div>
  )
}
