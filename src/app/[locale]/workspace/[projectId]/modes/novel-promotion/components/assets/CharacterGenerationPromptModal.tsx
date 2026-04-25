'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'

interface CharacterGenerationPromptModalProps {
  isOpen: boolean
  characterName: string
  initialValues: string[]
  initialPromptSuffix: string
  initialArtStylePrompt: string
  isSaving: boolean
  onClose: () => void
  onSave: (payload: {
    descriptions: string[]
    promptSuffixOverride: string
    artStylePromptOverride: string
  }) => Promise<void>
}

export default function CharacterGenerationPromptModal({
  isOpen,
  characterName,
  initialValues,
  initialPromptSuffix,
  initialArtStylePrompt,
  isSaving,
  onClose,
  onSave,
}: CharacterGenerationPromptModalProps) {
  const tProfile = useTranslations('assets.characterProfile')
  const tCommon = useTranslations('assets.common')
  const [drafts, setDrafts] = useState<string[]>(initialValues)
  const [promptSuffixDraft, setPromptSuffixDraft] = useState(initialPromptSuffix)
  const [artStylePromptDraft, setArtStylePromptDraft] = useState(initialArtStylePrompt)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setDrafts(Array.from({ length: 3 }, (_value, index) => initialValues[index] || ''))
    setPromptSuffixDraft(initialPromptSuffix)
    setArtStylePromptDraft(initialArtStylePrompt)
    setError('')
  }, [initialArtStylePrompt, initialPromptSuffix, initialValues, isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    const nextValues = drafts.map((item) => item.trim())
    if (!nextValues.some((item) => item)) return
    setError('')
    try {
      await onSave({
        descriptions: nextValues,
        promptSuffixOverride: promptSuffixDraft.trim(),
        artStylePromptOverride: artStylePromptDraft.trim(),
      })
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Save failed')
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center glass-overlay animate-fadeIn"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div className="glass-surface-modal w-[92vw] max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-stroke-base)]">
          <div>
            <h3 className="text-lg font-bold text-[var(--glass-text-primary)]">
              {tProfile('editGeneratePromptTitle', { name: characterName })}
            </h3>
            <p className="text-sm text-[var(--glass-text-secondary)]">
              {tProfile('editGeneratePromptSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="glass-btn-base glass-btn-soft rounded-full p-2 disabled:opacity-50"
          >
            <AppIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {drafts.map((draft, index) => (
            <div key={index} className="space-y-2">
              <div className="text-sm font-medium text-[var(--glass-text-primary)]">
                {tProfile('promptVariantLabel', { number: index + 1 })}
              </div>
              <textarea
                value={draft}
                onChange={(event) => {
                  const next = [...drafts]
                  next[index] = event.target.value
                  setDrafts(next)
                }}
                placeholder={tProfile('promptVariantPlaceholder', { number: index + 1 })}
                className="min-h-[140px] w-full rounded-2xl border border-[var(--glass-stroke-strong)] bg-[var(--glass-bg-input)] px-4 py-3 text-sm text-[var(--glass-text-primary)] outline-none focus:border-[var(--glass-stroke-focus)]"
              />
            </div>
          ))}

          <div className="space-y-2">
            <div className="text-sm font-medium text-[var(--glass-text-primary)]">
              {tProfile('promptSuffixLabel')}
            </div>
            <textarea
              value={promptSuffixDraft}
              onChange={(event) => setPromptSuffixDraft(event.target.value)}
              placeholder={tProfile('promptSuffixPlaceholder')}
              className="min-h-[120px] w-full rounded-2xl border border-[var(--glass-stroke-strong)] bg-[var(--glass-bg-input)] px-4 py-3 text-sm text-[var(--glass-text-primary)] outline-none focus:border-[var(--glass-stroke-focus)]"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-[var(--glass-text-primary)]">
              {tProfile('artStylePromptLabel')}
            </div>
            <textarea
              value={artStylePromptDraft}
              onChange={(event) => setArtStylePromptDraft(event.target.value)}
              placeholder={tProfile('artStylePromptPlaceholder')}
              className="min-h-[120px] w-full rounded-2xl border border-[var(--glass-stroke-strong)] bg-[var(--glass-bg-input)] px-4 py-3 text-sm text-[var(--glass-text-primary)] outline-none focus:border-[var(--glass-stroke-focus)]"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[var(--glass-tone-danger-bg)] px-3 py-2 text-sm text-[var(--glass-tone-danger-fg)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--glass-stroke-base)]">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="glass-btn-base glass-btn-secondary px-4 py-2 disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={isSaving || !drafts.some((item) => item.trim())}
            className="glass-btn-base glass-btn-primary px-4 py-2 disabled:opacity-50"
          >
            {isSaving ? tCommon('loading') : tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modalContent

  return createPortal(modalContent, document.body)
}
