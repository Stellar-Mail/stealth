import { DemoCampaign } from '../fixtures/campaigns'

export type CampaignLintIssue = {
  id: string
  campaignId: string
  level: 'warning' | 'error'
  message: string
  reason?: string
}

// Simple heuristics to detect low-quality demo campaign content.
export function lintCampaigns(campaigns: DemoCampaign[]): CampaignLintIssue[] {
  const issues: CampaignLintIssue[] = []

  // detect duplicate subjects
  const subjMap = new Map<string, string[]>()
  for (const c of campaigns) {
    const key = (c.subject || '').trim().toLowerCase()
    if (!subjMap.has(key)) subjMap.set(key, [])
    subjMap.get(key)!.push(c.id)
  }

  for (const [subject, ids] of subjMap.entries()) {
    if (!subject) continue
    if (ids.length > 1) {
      for (const id of ids) {
        issues.push({
          id: `dup-subject-${id}`,
          campaignId: id,
          level: 'warning',
          message: 'Duplicate subject detected in demo data',
          reason: `Subject "${subject}" appears in ${ids.length} campaigns`,
        })
      }
    }
  }

  // heuristics per-campaign
  for (const c of campaigns) {
    const id = c.id

    // low quality: very short subject or subject is generic lorem
    const subj = (c.subject || '').trim()
    if (subj.length < 5) {
      issues.push({
        id: `short-subject-${id}`,
        campaignId: id,
        level: 'warning',
        message: 'Subject is very short or empty',
      })
    }

    const lower = subj.toLowerCase()
    if (lower.includes('lorem') || lower.includes('ipsum')) {
      issues.push({
        id: `lorem-subject-${id}`,
        campaignId: id,
        level: 'warning',
        message: 'Subject contains placeholder "lorem ipsum"',
      })
    }

    // body placeholder patterns
    const body = (c.body || '').toLowerCase()
    if (body.includes('{{firstname') || body.includes('{{firstName'.toLowerCase())) {
      issues.push({
        id: `placeholder-body-${id}`,
        campaignId: id,
        level: 'warning',
        message: 'Body contains template placeholders',
      })
    }

    if (body.includes('lorem ipsum') || body.split(' ').length < 6) {
      issues.push({
        id: `low-quality-body-${id}`,
        campaignId: id,
        level: 'warning',
        message: 'Body appears to be low-quality or placeholder text',
      })
    }

    // uppercase placeholder sender or name-like placeholders
    const sender = (c.senderName || '').trim()
    if (sender && sender === sender.toUpperCase() && sender.split(' ').length <= 3) {
      issues.push({
        id: `sender-placeholder-${id}`,
        campaignId: id,
        level: 'warning',
        message: 'Sender name looks like an unreplaced placeholder',
      })
    }

    // duplicate copy between subject and body (naive detection)
    if (body.includes(subj.toLowerCase()) && subj.length > 10 && body.length > 20) {
      issues.push({
        id: `dup-copy-${id}`,
        campaignId: id,
        level: 'warning',
        message: 'Body duplicates subject text — possible low-quality copy',
      })
    }
  }

  return issues
}

export default lintCampaigns
