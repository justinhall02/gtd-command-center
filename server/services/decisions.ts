import db from '../db.js'
import { v4 as uuid } from 'uuid'
import crypto from 'crypto'

export interface InputFeatures {
  from_domain: string
  subject_keywords: string[]
  has_attachments: boolean
  folder?: string
}

export interface Suggestion {
  action: string
  confidence: number
  matchCount: number
  features: InputFeatures
}

function extractFeatures(email: { from?: string; subject?: string; hasAttachments?: boolean; folder?: string }): InputFeatures {
  const fromDomain = (email.from || '').split('@')[1]?.toLowerCase() || 'unknown'

  // Extract meaningful keywords from subject (drop common words)
  const stopWords = new Set(['re:', 'fw:', 'fwd:', 'the', 'a', 'an', 'is', 'for', 'to', 'of', 'and', 'in', 'on', 'at', '-', ''])
  const keywords = (email.subject || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => !stopWords.has(w) && w.length > 2)
    .slice(0, 5) // top 5 keywords

  return {
    from_domain: fromDomain,
    subject_keywords: keywords,
    has_attachments: !!email.hasAttachments,
    folder: email.folder,
  }
}

function fingerprint(features: InputFeatures): string {
  // Hash on domain + sorted keywords for matching
  const sig = `${features.from_domain}|${features.subject_keywords.sort().join(',')}`
  return crypto.createHash('md5').update(sig).digest('hex').slice(0, 12)
}

export function recordDecision(
  type: 'process' | 'execute',
  email: { from?: string; subject?: string; hasAttachments?: boolean; folder?: string },
  actualAction: string,
  suggestedAction?: string,
  toolsUsed?: string[],
  correctionNotes?: string
): void {
  const features = extractFeatures(email)
  const fp = fingerprint(features)

  db.prepare(`
    INSERT INTO decisions (id, type, input_fingerprint, input_features, suggested_action, actual_action, tools_used, was_correction, correction_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuid(),
    type,
    fp,
    JSON.stringify(features),
    suggestedAction || null,
    actualAction,
    toolsUsed ? JSON.stringify(toolsUsed) : null,
    suggestedAction && suggestedAction !== actualAction ? 1 : 0,
    correctionNotes || null
  )
}

export function getSuggestion(email: { from?: string; subject?: string; hasAttachments?: boolean; folder?: string }): Suggestion | null {
  const features = extractFeatures(email)
  const fp = fingerprint(features)

  // Find matching past decisions
  const matches = db.prepare(`
    SELECT actual_action, COUNT(*) as cnt
    FROM decisions
    WHERE input_fingerprint = ? AND type = 'process'
    GROUP BY actual_action
    ORDER BY cnt DESC
    LIMIT 1
  `).get(fp) as { actual_action: string; cnt: number } | undefined

  if (!matches || matches.cnt < 3) return null

  // Count total decisions with this fingerprint
  const total = db.prepare(`
    SELECT COUNT(*) as total FROM decisions WHERE input_fingerprint = ? AND type = 'process'
  `).get(fp) as { total: number }

  return {
    action: matches.actual_action,
    confidence: Math.round((matches.cnt / total.total) * 100),
    matchCount: matches.cnt,
    features,
  }
}

// Get folder usage frequency for sorting misroute/move menus
export function getFolderUsageRanking(): Array<{ folder: string; count: number }> {
  const rows = db.prepare(`
    SELECT destination as folder, COUNT(*) as cnt
    FROM processed_emails
    WHERE action IN ('moved', 'misrouted') AND destination IS NOT NULL
    ORDER BY cnt DESC
    LIMIT 100
  `).all() as Array<{ folder: string; cnt: number }>

  return rows.map(r => ({ folder: r.folder, count: r.cnt }))
}

// Get misroute patterns — which source folders keep getting corrected to which destinations
export function getMisroutePatterns(): Array<{ fromFolder: string; toFolder: string; count: number; suggestion: string }> {
  const rows = db.prepare(`
    SELECT
      json_extract(input_features, '$.folder') as from_folder,
      correction_notes,
      COUNT(*) as cnt
    FROM decisions
    WHERE type = 'process' AND was_correction = 1 AND correction_notes IS NOT NULL
    GROUP BY from_folder, correction_notes
    ORDER BY cnt DESC
  `).all() as any[]

  return rows.map(r => {
    // Parse "Was in X, should be in Y" format
    const match = (r.correction_notes || '').match(/Was in (.+), should be in (.+)/)
    return {
      fromFolder: match?.[1] || r.from_folder || 'unknown',
      toFolder: match?.[2] || 'unknown',
      count: r.cnt,
      suggestion: `Emails keep getting misrouted from "${match?.[1]}" to "${match?.[2]}" (${r.cnt} times). Consider updating your mail rules.`,
    }
  }).filter(r => r.toFolder !== 'unknown')
}

export function getPatterns(): Array<{ fingerprint: string; features: InputFeatures; topAction: string; count: number; confidence: number }> {
  const rows = db.prepare(`
    SELECT input_fingerprint, input_features, actual_action,
           COUNT(*) as cnt,
           COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY input_fingerprint) as confidence
    FROM decisions
    WHERE type = 'process'
    GROUP BY input_fingerprint, actual_action
    ORDER BY cnt DESC
    LIMIT 20
  `).all() as any[]

  return rows.map(r => ({
    fingerprint: r.input_fingerprint,
    features: JSON.parse(r.input_features),
    topAction: r.actual_action,
    count: r.cnt,
    confidence: Math.round(r.confidence),
  }))
}
