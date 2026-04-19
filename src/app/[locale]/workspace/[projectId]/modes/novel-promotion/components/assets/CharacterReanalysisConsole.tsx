'use client'

import { useEffect, useMemo, useState } from 'react'
import LLMStageStreamCard, { type LLMStageViewItem } from '@/components/llm-console/LLMStageStreamCard'
import { useTranslations } from 'next-intl'

type RunStreamStep = {
  id: string
}

type RunStreamState = {
  isVisible: boolean
  isRunning: boolean
  isRecoveredRunning: boolean
  status?: 'idle' | 'running' | 'completed' | 'failed'
  stages: LLMStageViewItem[]
  selectedStep?: RunStreamStep | null
  activeStepId?: string | null
  outputText: string
  activeMessage?: string
  overallProgress: number
  errorMessage?: string
  reset: () => void
  stop: () => void
  selectStep: (stepId: string) => void
}

interface CharacterReanalysisConsoleProps {
  stream: RunStreamState
}

export default function CharacterReanalysisConsole({ stream }: CharacterReanalysisConsoleProps) {
  const t = useTranslations('progress')
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    if (stream.isVisible && (stream.isRunning || stream.isRecoveredRunning || stream.status === 'running')) {
      setMinimized(false)
    }
  }, [stream.isRecoveredRunning, stream.isRunning, stream.isVisible, stream.status])

  const stages = useMemo(() => {
    if (stream.stages.length > 0) return stream.stages
    return [{
      id: 'analyze_characters',
      title: t('streamStep.analyzeCharacters'),
      status: stream.status === 'failed' ? 'failed' : 'processing',
      progress: stream.overallProgress || 0,
    } satisfies LLMStageViewItem]
  }, [stream.overallProgress, stream.stages, stream.status, t])

  if (!stream.isVisible) return null

  const isActive = stream.isRunning || stream.isRecoveredRunning || stream.status === 'running'
  const selectedStageId = stream.selectedStep?.id || stream.activeStepId || stages[0]?.id

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed right-6 bottom-6 z-120 glass-surface-modal rounded-2xl px-4 py-3 text-sm font-medium text-(--glass-tone-info-fg)"
      >
        {t('streamStep.analyzeCharacters')}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-120 glass-overlay backdrop-blur-sm">
      <div className="mx-auto mt-4 h-[calc(100vh-2rem)] w-[min(96vw,1400px)]">
        <LLMStageStreamCard
          title={t('streamStep.analyzeCharacters')}
          subtitle={t('taskType.analyzeGlobal')}
          stages={stages}
          activeStageId={stream.activeStepId || stages[0]?.id || 'analyze_characters'}
          selectedStageId={selectedStageId || undefined}
          onSelectStage={stream.selectStep}
          outputText={stream.outputText}
          activeMessage={stream.activeMessage}
          overallProgress={stream.overallProgress}
          autoScroll={selectedStageId === stream.activeStepId}
          showCursor={isActive && stream.selectedStep?.id === stream.activeStepId}
          errorMessage={stream.errorMessage}
          topRightAction={(
            <div className="flex items-center gap-2">
              {isActive && (
                <button
                  type="button"
                  onClick={stream.stop}
                  className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs"
                >
                  {t('runConsole.stop')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs"
              >
                {t('runConsole.minimize')}
              </button>
              {!isActive && (
                <button
                  type="button"
                  onClick={stream.reset}
                  className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs"
                >
                  {t('runConsole.close')}
                </button>
              )}
            </div>
          )}
        />
      </div>
    </div>
  )
}
