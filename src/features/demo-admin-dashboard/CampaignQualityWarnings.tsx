import React from 'react'
import { Campaign, Issue, flagCampaign } from './campaignQuality'

export function CampaignQualityWarnings({ campaign, others }: { campaign: Campaign; others?: Campaign[] }) {
  const issues: Issue[] = flagCampaign(campaign, others || [])
  if (!issues || issues.length === 0) return null
  return (
    <div aria-live="polite" style={{ borderLeft: '4px solid #f59e0b', padding: '8px', background: '#fffbeb' }}>
      <strong>Campaign quality warnings</strong>
      <ul style={{ margin: '6px 0' }}>
        {issues.map((i) => (
          <li key={i.code}>
            <strong>{i.severity}:</strong> {i.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default CampaignQualityWarnings
