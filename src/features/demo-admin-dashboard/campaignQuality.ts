export type Campaign = {
  id: string
  name?: string
  subject?: string
  body?: string
  cta?: string
  audience?: string[]
  startDate?: string
  endDate?: string
  metadata?: Record<string, string>
}

export type Issue = {
  code: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

function normalize(s?: string) {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const placeholderPattern = /lorem|ipsum|placeholder|todo|tbd|xxx|example\.com|first name|john doe|some text|sample text|{{\s*\w+\s*}}/i
const genericCtas = ['learn more', 'click here', 'read more', 'more info', 'learn more »']

export function flagCampaign(campaign: Campaign, others: Campaign[] = []): Issue[] {
  const issues: Issue[] = []
  const subj = normalize(campaign.subject)
  const body = normalize(campaign.body)
  const cta = normalize(campaign.cta)

  if (!campaign.audience || campaign.audience.length === 0) {
    issues.push({ code: 'missing_targeting', message: 'No audience/targeting defined', severity: 'warning' })
  }

  if (subj.length === 0 && body.length === 0) {
    issues.push({ code: 'empty_copy', message: 'Subject and body are empty', severity: 'error' })
    return issues
  }

  if (placeholderPattern.test(campaign.subject || '') || placeholderPattern.test(campaign.body || '')) {
    issues.push({ code: 'placeholder_text', message: 'Contains placeholder or example text', severity: 'warning' })
  }

  if (subj && subj.length < 15) {
    issues.push({ code: 'too_short_subject', message: 'Subject looks very short', severity: 'info' })
  }

  if (body && body.length < 40) {
    issues.push({ code: 'too_short_body', message: 'Body looks very short', severity: 'info' })
  }

  if (campaign.subject && /\b[A-Z\s]{5,}\b/.test(campaign.subject) && campaign.subject === (campaign.subject || '').toUpperCase()) {
    issues.push({ code: 'all_caps_subject', message: 'Subject is all-caps', severity: 'info' })
  }

  if (cta && genericCtas.includes(cta)) {
    issues.push({ code: 'generic_cta', message: 'CTA is very generic', severity: 'info' })
  }

  // Date checks
  if (campaign.startDate && campaign.endDate) {
    const s = Date.parse(campaign.startDate)
    const e = Date.parse(campaign.endDate)
    if (!isNaN(s) && !isNaN(e)) {
      if (e < s) {
        issues.push({ code: 'date_range_invalid', message: 'End date is before start date', severity: 'warning' })
      }
      if (e === s) {
        issues.push({ code: 'same_day_dates', message: 'Start and end date are the same', severity: 'info' })
      }
    }
  }

  // Repetitive / duplicate sentences
  const sentences = (campaign.body || '').split(/[\.\!\?]+/).map((s) => normalize(s)).filter(Boolean)
  const counts = sentences.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const repetitive = Object.values(counts).some((c) => c > 2)
  if (repetitive) {
    issues.push({ code: 'repetitive_copy', message: 'Body contains repetitive sentences', severity: 'info' })
  }

  // Duplicate across provided campaigns
  for (const other of others) {
    if (other.id === campaign.id) continue
    const oSubj = normalize(other.subject)
    const oBody = normalize(other.body)
    if (subj && subj.length > 0 && oSubj === subj) {
      issues.push({ code: 'duplicate_copy', message: `Subject identical to campaign ${other.id}`, severity: 'warning' })
      break
    }
    if (body && body.length > 0 && oBody === body) {
      issues.push({ code: 'duplicate_copy', message: `Body identical to campaign ${other.id}`, severity: 'warning' })
      break
    }
  }

  return issues
}

export function summarizeIssues(issues: Issue[]) {
  const bySeverity: Record<string, Issue[]> = { info: [], warning: [], error: [] }
  for (const i of issues) bySeverity[i.severity].push(i)
  return bySeverity
}
