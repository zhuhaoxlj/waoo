'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import PromptTemplateModal from './PromptTemplateModal'

interface PromptEditorPayload {
  content: string
  source: 'default' | 'override'
  filePath: string
}

interface CharacterAnalysisPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function CharacterAnalysisPromptModal({
  isOpen,
  onClose,
  onSaved,
}: CharacterAnalysisPromptModalProps) {
  const locale = useLocale()
  const tRunConsole = useTranslations('progress.runConsole')
  const tAssets = useTranslations('assets.characterProfile')
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState<'default' | 'override'>('default')
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    let active = true
    setLoading(true)
    setError('')

    void (async () => {
      try {
        const response = await fetch(`/api/user/story-to-script-prompts/analyze_characters?locale=${encodeURIComponent(locale)}`)
        const payload = await response.json().catch(() => null) as PromptEditorPayload | null
        if (!response.ok || !payload) {
          throw new Error(tRunConsole('promptEditorLoadFailed'))
        }
        if (!active) return
        setDraft(payload.content)
        setSource(payload.source)
        setFilePath(payload.filePath)
      } catch (fetchError: unknown) {
        if (!active) return
        setError(fetchError instanceof Error ? fetchError.message : tRunConsole('promptEditorLoadFailed'))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [isOpen, locale, tRunConsole])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!draft.trim()) {
      setError(tRunConsole('promptEditorSaveFailed'))
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/user/story-to-script-prompts/analyze_characters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          content: draft,
        }),
      })
      const payload = await response.json().catch(() => null) as PromptEditorPayload | null
      if (!response.ok || !payload) {
        throw new Error(tRunConsole('promptEditorSaveFailed'))
      }
      setDraft(payload.content)
      setSource(payload.source)
      setFilePath(payload.filePath)
      onSaved?.()
      onClose()
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : tRunConsole('promptEditorSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PromptTemplateModal
      isOpen={isOpen}
      title={tAssets('editAnalyzePrompt')}
      subtitle={tRunConsole('promptEditorSubtitle')}
      draft={draft}
      source={source}
      filePath={filePath}
      loading={loading}
      saving={saving}
      error={error}
      onChange={setDraft}
      onClose={onClose}
      onSave={() => void handleSave()}
    />
  )
}
