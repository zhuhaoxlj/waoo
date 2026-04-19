'use client'

import { createPortal } from 'react-dom'
import TaskStatusInline from '@/components/task/TaskStatusInline'
import type { TaskPresentationState } from '@/lib/task/presentation'
import { AppIcon } from '@/components/ui/icons'

interface AssetsStageStatusOverlaysProps {
  isGlobalAnalyzing: boolean
  globalAnalyzingState: TaskPresentationState | null
  globalAnalyzingTitle: string
  globalAnalyzingHint: string
  globalAnalyzingTip: string
}

export default function AssetsStageStatusOverlays({
  isGlobalAnalyzing,
  globalAnalyzingState,
  globalAnalyzingTitle,
  globalAnalyzingHint,
  globalAnalyzingTip,
}: AssetsStageStatusOverlaysProps) {
  if (!isGlobalAnalyzing) return null

  const overlayContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay">
      <div className="glass-surface-modal p-8 max-w-md mx-4 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-[var(--glass-accent-from)] flex items-center justify-center">
              <AppIcon name="ideaAlt" className="w-10 h-10 text-white" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-[var(--glass-text-primary)] mb-2">
            {globalAnalyzingTitle}
          </h3>
          <p className="text-[var(--glass-text-tertiary)] text-sm mb-4">{globalAnalyzingHint}</p>
          <TaskStatusInline state={globalAnalyzingState} />

          <div className="w-full h-2 bg-[var(--glass-bg-muted)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--glass-accent-from)] rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
          <p className="text-xs text-[var(--glass-text-tertiary)] mt-2">{globalAnalyzingTip}</p>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return overlayContent

  return createPortal(overlayContent, document.body)
}
