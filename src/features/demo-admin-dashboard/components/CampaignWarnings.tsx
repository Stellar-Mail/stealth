import React from 'react'
import { CampaignLintIssue } from '../lib/campaignLint'

export const CampaignWarnings: React.FC<{ issues: CampaignLintIssue[] }> = ({ issues }) => {
  if (!issues || issues.length === 0) return null

  return (
    <div aria-live="polite" style={{ border: '1px solid #f1c40f', padding: 12, borderRadius: 6, background: '#fffbe6' }}>
      <strong>Demo campaign warnings</strong>
      <ul style={{ margin: '8px 0 0 16px' }}>
        {issues.map((i) => (
          <li key={i.id}>
            <strong>{i.level.toUpperCase()}:</strong> {i.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default CampaignWarnings
