'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import LLMStageStreamCard, { type LLMStageViewItem } from '@/components/llm-console/LLMStageStreamCard'
import { useTranslations } from 'next-intl'
import { getStageOutput } from '@/lib/query/hooks/run-stream/state-machine'
import type { RunStepState } from '@/lib/query/hooks/run-stream/types'

type RunStreamStep = {
  id: string
}

type RunStreamState = {
  isVisible: boolean
  isRunning: boolean
  isRecoveredRunning: boolean
  status?: 'idle' | 'running' | 'completed' | 'failed'
  stages: LLMStageViewItem[]
  orderedSteps?: RunStepState[]
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

function remapReanalysisLabel(input: string): string {
  if (!input) return input

  return input
    .replaceAll('准备全局资产分析参数', '准备角色分析参数')
    .replaceAll('分析全局资产切片', '分析角色切片')
    .replaceAll('全局资产分析完成', '角色分析完成')
    .replaceAll('全局资产分析', '角色分析')
    .replaceAll('global asset analysis', 'character analysis')
    .replaceAll('Global asset analysis', 'Character analysis')
    .replaceAll('Analyze global assets', 'Analyze characters')
}

function isCharacterStepId(stepId: string | null | undefined): boolean {
  return typeof stepId === 'string' && stepId.startsWith('analyze_global_characters_')
}

function isCharacterStage(stage: LLMStageViewItem): boolean {
  return isCharacterStepId(stage.id) || stage.title.includes('角色分析') || stage.title.toLowerCase().includes('character')
}

function resolveCharacterStepMessage(step: RunStepState | null): string {
  if (!step) return ''
  if (step.errorMessage) return step.errorMessage
  if (step.status === 'completed') return 'progress.runtime.llm.completed'
  if (step.status === 'failed') return 'progress.runtime.llm.failed'
  return step.message || 'progress.runtime.llm.processing'
}

export default function CharacterReanalysisConsole({ stream }: CharacterReanalysisConsoleProps) {
  const t = useTranslations('progress')
  const tAssets = useTranslations('assets.characterProfile')
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    if (stream.isVisible && (stream.isRunning || stream.isRecoveredRunning || stream.status === 'running')) {
      setMinimized(false)
    }
  }, [stream.isRecoveredRunning, stream.isRunning, stream.isVisible, stream.status])

  const stages = useMemo(() => {
    const visibleStages = stream.stages.filter(isCharacterStage)
    const sourceStages = visibleStages.length > 0 ? visibleStages : stream.stages

    if (sourceStages.length > 0) {
      return sourceStages.map((stage) => ({
        ...stage,
        title: remapReanalysisLabel(stage.title),
        subtitle: stage.subtitle ? remapReanalysisLabel(stage.subtitle) : stage.subtitle,
      }))
    }
    return [{
      id: 'analyze_characters',
      title: t('streamStep.analyzeCharacters'),
      status: stream.status === 'failed' ? 'failed' : 'processing',
      progress: stream.overallProgress || 0,
    } satisfies LLMStageViewItem]
  }, [stream.overallProgress, stream.stages, stream.status, t])

  const visibleSteps = useMemo(() => {
    const steps = Array.isArray(stream.orderedSteps) ? stream.orderedSteps : []
    const characterSteps = steps.filter((step) => isCharacterStepId(step.id) || step.title.includes('角色分析'))
    return characterSteps.length > 0 ? characterSteps : steps
  }, [stream.orderedSteps])

  if (!stream.isVisible) return null

  const isActive = stream.isRunning || stream.isRecoveredRunning || stream.status === 'running'
  const activeStageId = stages.find((stage) => stage.id === stream.activeStepId)?.id || stages[0]?.id
  const selectedStageId = stages.find((stage) => stage.id === stream.selectedStep?.id)?.id || activeStageId
  const selectedVisibleStep = visibleSteps.find((step) => step.id === selectedStageId) || visibleSteps[0] || null
  const selectedOutputText = getStageOutput(selectedVisibleStep) || stream.outputText
  const selectedActiveMessage = selectedVisibleStep
    ? resolveCharacterStepMessage(selectedVisibleStep)
    : stream.activeMessage || ''
  const selectedErrorMessage = selectedVisibleStep?.errorMessage || stream.errorMessage || ''
  const visibleStageCount = Math.max(1, stages.length)
  const completedVisibleStageCount = stages.filter((stage) => stage.status === 'completed' || stage.status === 'stale').length
  const currentVisibleStep = isActive
    ? Math.min(visibleStageCount, Math.max(1, completedVisibleStageCount || 1))
    : visibleStageCount

  if (minimized) {
    const minimizedContent = (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed right-6 bottom-6 z-120 glass-surface-modal rounded-2xl px-4 py-3 text-sm font-medium text-(--glass-tone-info-fg)"
      >
        {tAssets('reanalysisConsoleTitle')}
      </button>
    )

    if (typeof document === 'undefined') return minimizedContent

    return createPortal(minimizedContent, document.body)
  }

  const consoleContent = (
    <div className="fixed inset-0 z-120 glass-overlay backdrop-blur-sm">
      <div className="mx-auto mt-4 h-[calc(100vh-2rem)] w-[min(96vw,1400px)]">
        <LLMStageStreamCard
          title={tAssets('reanalysisConsoleTitle')}
          subtitle={tAssets('reanalysisConsoleSubtitle')}
          stages={stages}
          stageCountOverride={visibleStageCount}
          currentStepOverride={currentVisibleStep}
          activeStageId={activeStageId || 'analyze_characters'}
          selectedStageId={selectedStageId || undefined}
          onSelectStage={stream.selectStep}
          outputText={selectedOutputText}
          activeMessage={selectedActiveMessage ? remapReanalysisLabel(selectedActiveMessage) : selectedActiveMessage}
          overallProgress={stream.overallProgress}
          autoScroll={selectedStageId === activeStageId}
          showCursor={isActive && selectedStageId === activeStageId}
          errorMessage={selectedErrorMessage ? remapReanalysisLabel(selectedErrorMessage) : selectedErrorMessage}
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

  if (typeof document === 'undefined') return consoleContent

  return createPortal(consoleContent, document.body)
}
