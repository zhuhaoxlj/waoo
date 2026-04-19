'use client'

import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/icons'
import { useTranslations } from 'next-intl'

interface PromptTemplateModalProps {
  isOpen: boolean
  title: string
  subtitle: string
  draft: string
  source: 'default' | 'override'
  filePath: string
  loading: boolean
  saving: boolean
  error: string
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
}

export default function PromptTemplateModal({
  isOpen,
  title,
  subtitle,
  draft,
  source,
  filePath,
  loading,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: PromptTemplateModalProps) {
  const tRunConsole = useTranslations('progress.runConsole')
  const tCommon = useTranslations('assets.common')

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center glass-overlay animate-fadeIn"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <div className="glass-surface-modal w-[92vw] max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-stroke-base)]">
          <div>
            <h3 className="text-lg font-bold text-[var(--glass-text-primary)]">{title}</h3>
            <p className="text-sm text-[var(--glass-text-secondary)]">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="glass-btn-base glass-btn-soft rounded-full p-2 disabled:opacity-50"
          >
            <AppIcon name="close" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-sm text-[var(--glass-text-secondary)]">{tRunConsole('promptEditorLoading')}</div>
          ) : (
            <>
              <div className="rounded-xl bg-[var(--glass-bg-muted)] p-3 text-sm text-[var(--glass-text-secondary)] space-y-1">
                <div>
                  {tRunConsole('promptEditorSource')}:
                  {' '}
                  {source === 'override' ? tRunConsole('promptEditorSourceOverride') : tRunConsole('promptEditorSourceDefault')}
                </div>
                <div className="break-all">
                  {tRunConsole('promptEditorPath')}:
                  {' '}
                  {filePath || '-'}
                </div>
              </div>

              <textarea
                value={draft}
                onChange={(event) => onChange(event.target.value)}
                placeholder={tRunConsole('promptEditorPlaceholder')}
                className="min-h-[420px] w-full rounded-2xl border border-[var(--glass-stroke-strong)] bg-[var(--glass-bg-input)] px-4 py-3 text-sm text-[var(--glass-text-primary)] outline-none focus:border-[var(--glass-stroke-focus)]"
              />
            </>
          )}

          {error && (
            <div className="rounded-xl bg-[var(--glass-tone-danger-bg)] px-3 py-2 text-sm text-[var(--glass-tone-danger-fg)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--glass-stroke-base)]">
          <button
            onClick={onClose}
            disabled={saving}
            className="glass-btn-base glass-btn-secondary px-4 py-2 disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={loading || saving || !draft.trim()}
            className="glass-btn-base glass-btn-primary px-4 py-2 disabled:opacity-50"
          >
            {saving ? tCommon('loading') : tRunConsole('savePrompt')}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return modalContent

  return createPortal(modalContent, document.body)
}
