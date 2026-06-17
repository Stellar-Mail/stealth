import { describe, it, expect } from 'vitest'
import { demoCampaigns } from '../fixtures/campaigns'
import { lintCampaigns } from '../lib/campaignLint'

describe('demo campaign linting', () => {
  it('finds duplicate subject issues', () => {
    const issues = lintCampaigns(demoCampaigns)
    const dupIssues = issues.filter((i) => i.id.startsWith('dup-subject'))
    expect(dupIssues.length).toBeGreaterThanOrEqual(2)
    const ids = dupIssues.map((i) => i.campaignId)
    expect(ids).toContain('c-003')
    expect(ids).toContain('c-004')
  })

  it('flags lorem ipsum and placeholders', () => {
    const issues = lintCampaigns(demoCampaigns)
    const lorem = issues.find((i) => i.id.includes('lorem-subject'))
    expect(lorem).toBeDefined()
    const placeholder = issues.find((i) => i.id.includes('placeholder-body'))
    expect(placeholder).toBeDefined()
  })
})
