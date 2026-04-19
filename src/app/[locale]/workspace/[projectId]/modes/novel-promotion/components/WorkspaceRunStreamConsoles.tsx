'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import LLMStageStreamCard, { type LLMStageViewItem } from '@/components/llm-console/LLMStageStreamCard'
import { useToast } from '@/contexts/ToastContext'
import { useLocale, useTranslations } from 'next-intl'
import {
  STORY_TO_SCRIPT_EDITABLE_STAGES,
  resolveStoryToScriptStageId,
  type StoryToScriptEditableStageId,
} from '@/lib/novel-promotion/story-to-script-stage-prompts'
import PromptTemplateModal from './assets/PromptTemplateModal'

type RunStreamStep = {
  id: string
  title?: string
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'stale'
  retryable?: boolean
}

type RunStreamState = {
  status?: 'idle' | 'running' | 'completed' | 'failed'
  isVisible: boolean
  isRecoveredRunning: boolean
  stages: LLMStageViewItem[]
  selectedStep?: RunStreamStep | null
  activeStepId?: string | null
  outputText: string
  activeMessage?: string
  overallProgress: number
  isRunning: boolean
  errorMessage?: string
  stop: () => void
  reset: () => void
  selectStep: (stepId: string) => void
  retryStep: (params: { stepId: string; modelOverride?: string; reason?: string }) => Promise<{
    runId: string
    status: string
    summary: Record<string, unknown> | null
    payload: Record<string, unknown> | null
    errorMessage: string
  }>
}

interface WorkspaceRunStreamConsolesProps {
  storyToScriptStream: RunStreamState
  scriptToStoryboardStream: RunStreamState
  storyToScriptPendingStart?: boolean
  storyToScriptLaunching?: boolean
  storyToScriptConsoleMinimized: boolean
  scriptToStoryboardConsoleMinimized: boolean
  onStartStoryToScript?: () => void
  onCancelStoryToScriptPendingStart?: () => void
  onStoryToScriptMinimizedChange: (next: boolean) => void
  onScriptToStoryboardMinimizedChange: (next: boolean) => void
  hideMinimizedBadges?: boolean
}

type PromptEditorState = {
  stageId: StoryToScriptEditableStageId
  title: string
  content: string
  source: 'default' | 'override'
  filePath: string
  defaultFilePath: string
  overrideFilePath: string
}

function aggregateStoryToScriptStages(stages: LLMStageViewItem[]): LLMStageViewItem[] {
  return STORY_TO_SCRIPT_EDITABLE_STAGES.map((stageDef) => {
    const matched = stages.filter((stage) => resolveStoryToScriptStageId(stage.id) === stageDef.id)
    if (matched.length === 0) {
      return {
        id: stageDef.id,
        title: stageDef.titleKey,
        status: 'pending',
        progress: 0,
      } satisfies LLMStageViewItem
    }

    if (matched.some((stage) => stage.status === 'failed')) {
      return {
        id: stageDef.id,
        title: stageDef.titleKey,
        status: 'failed',
        progress: Math.max(...matched.map((stage) => stage.progress || 0), 0),
        retryable: matched.some((stage) => stage.retryable !== false),
      } satisfies LLMStageViewItem
    }

    if (matched.some((stage) => stage.status === 'processing')) {
      return {
        id: stageDef.id,
        title: stageDef.titleKey,
        status: 'processing',
        progress: Math.max(...matched.map((stage) => stage.progress || 0), 0),
      } satisfies LLMStageViewItem
    }

    if (matched.some((stage) => stage.status === 'blocked')) {
      return {
        id: stageDef.id,
        title: stageDef.titleKey,
        status: 'blocked',
        progress: Math.max(...matched.map((stage) => stage.progress || 0), 0),
      } satisfies LLMStageViewItem
    }

    if (matched.some((stage) => stage.status === 'queued')) {
      return {
        id: stageDef.id,
        title: stageDef.titleKey,
        status: 'queued',
        progress: Math.max(...matched.map((stage) => stage.progress || 0), 0),
      } satisfies LLMStageViewItem
    }

    return {
      id: stageDef.id,
      title: stageDef.titleKey,
      status: matched.every((stage) => stage.status === 'completed' || stage.status === 'stale') ? 'completed' : 'pending',
      progress: matched.every((stage) => stage.status === 'completed' || stage.status === 'stale')
        ? 100
        : Math.max(...matched.map((stage) => stage.progress || 0), 0),
    } satisfies LLMStageViewItem
  })
}

export default function WorkspaceRunStreamConsoles({
  storyToScriptStream,
  scriptToStoryboardStream,
  storyToScriptPendingStart,
  storyToScriptLaunching,
  storyToScriptConsoleMinimized,
  scriptToStoryboardConsoleMinimized,
  onStartStoryToScript,
  onCancelStoryToScriptPendingStart,
  onStoryToScriptMinimizedChange,
  onScriptToStoryboardMinimizedChange,
  hideMinimizedBadges,
}: WorkspaceRunStreamConsolesProps) {
  const t = useTranslations('progress')
  const locale = useLocale()
  const { showToast } = useToast()
  const [promptEditor, setPromptEditor] = useState<PromptEditorState | null>(null)
  const [promptEditorDraft, setPromptEditorDraft] = useState('')
  const [promptEditorLoading, setPromptEditorLoading] = useState(false)
  const [promptEditorSaving, setPromptEditorSaving] = useState(false)
  const [promptEditorError, setPromptEditorError] = useState('')
  const storyToScriptActive =
    !!storyToScriptPendingStart ||
    !!storyToScriptLaunching ||
    storyToScriptStream.isRunning ||
    storyToScriptStream.isRecoveredRunning ||
    storyToScriptStream.status === 'running'
  const scriptToStoryboardActive =
    scriptToStoryboardStream.isRunning ||
    scriptToStoryboardStream.isRecoveredRunning ||
    scriptToStoryboardStream.status === 'running'

  const showStoryToScriptConsole =
    (storyToScriptPendingStart || storyToScriptLaunching || storyToScriptStream.isVisible) &&
    (storyToScriptPendingStart || storyToScriptLaunching || storyToScriptStream.stages.length > 0 || !!storyToScriptStream.errorMessage || storyToScriptActive)
  const storyFallbackStatus: LLMStageViewItem['status'] =
    storyToScriptPendingStart
      ? 'pending'
      : storyToScriptStream.status === 'failed'
        ? 'failed'
        : 'processing'
  const storyToScriptStages = useMemo(() => {
    if (storyToScriptStream.stages.length > 0) {
      return aggregateStoryToScriptStages(storyToScriptStream.stages)
    }
    if (storyToScriptPendingStart || storyToScriptLaunching) {
      return STORY_TO_SCRIPT_EDITABLE_STAGES.map((stage) => ({
        id: stage.id,
        title: stage.titleKey,
        status: 'pending' as const,
        progress: 0,
      }))
    }
    return [{
      id: 'story_to_script_run',
      title: t('runConsole.storyToScript'),
      status: storyFallbackStatus,
      progress: 0,
      subtitle: storyToScriptStream.errorMessage || undefined,
    }]
  }, [
    storyFallbackStatus,
    storyToScriptLaunching,
    storyToScriptPendingStart,
    storyToScriptStream.errorMessage,
    storyToScriptStream.stages,
    t,
  ])
  const storyToScriptActiveAggregateStageId =
    resolveStoryToScriptStageId(storyToScriptStream.activeStepId) ||
    storyToScriptStages.find((stage) => stage.status === 'processing' || stage.status === 'failed')?.id ||
    storyToScriptStages.find((stage) => stage.status === 'completed')?.id ||
    storyToScriptStages[0]?.id ||
    null
  const storyToScriptActiveStage = storyToScriptStream.activeStepId
    ? storyToScriptStages.find((stage) => stage.id === storyToScriptActiveAggregateStageId) || null
    : null
  const storyToScriptCardTitle =
    storyToScriptActiveStage?.title ||
    t('runConsole.storyToScript')
  const storyToScriptSelectedStageId = resolveStoryToScriptStageId(
    storyToScriptStream.selectedStep?.id || storyToScriptStream.activeStepId || null,
  )
  const storyToScriptSelectedStage = storyToScriptSelectedStageId
    ? storyToScriptStages.find((stage) => stage.id === storyToScriptSelectedStageId) || null
    : null
  const storyToScriptShowCursor =
    !storyToScriptPendingStart &&
    storyToScriptStream.isRunning &&
    storyToScriptStream.selectedStep?.id === storyToScriptStream.activeStepId &&
    storyToScriptSelectedStage?.status === 'processing'
  const showScriptToStoryboardConsole =
    scriptToStoryboardStream.isVisible &&
    (scriptToStoryboardStream.stages.length > 0 || !!scriptToStoryboardStream.errorMessage || scriptToStoryboardActive)
  const storyboardFallbackStatus: LLMStageViewItem['status'] =
    scriptToStoryboardStream.status === 'failed' ? 'failed' : 'processing'
  const scriptToStoryboardStages = scriptToStoryboardStream.stages.length > 0
    ? scriptToStoryboardStream.stages
    : [{
      id: 'script_to_storyboard_run',
      title: t('runConsole.scriptToStoryboard'),
      status: storyboardFallbackStatus,
      progress: 0,
      subtitle: scriptToStoryboardStream.errorMessage || undefined,
    }]
  const scriptToStoryboardActiveStage = scriptToStoryboardStream.activeStepId
    ? scriptToStoryboardStages.find((stage) => stage.id === scriptToStoryboardStream.activeStepId) || null
    : null
  const scriptToStoryboardCardTitle =
    scriptToStoryboardActiveStage?.title ||
    t('runConsole.scriptToStoryboard')
  const scriptToStoryboardSelectedStageId =
    scriptToStoryboardStream.selectedStep?.id || scriptToStoryboardStream.activeStepId || null
  const scriptToStoryboardSelectedStage = scriptToStoryboardSelectedStageId
    ? scriptToStoryboardStages.find((stage) => stage.id === scriptToStoryboardSelectedStageId) || null
    : null
  const scriptToStoryboardShowCursor =
    scriptToStoryboardStream.isRunning &&
    scriptToStoryboardStream.selectedStep?.id === scriptToStoryboardStream.activeStepId &&
    scriptToStoryboardSelectedStage?.status === 'processing'

  const handleRetryStepById = async (
    stream: RunStreamState,
    stepId: string,
  ) => {
    const input = typeof window !== 'undefined'
      ? window.prompt('可选：输入重试模型（留空使用当前模型）')
      : null
    const modelOverride = typeof input === 'string' ? input.trim() : ''
    await stream.retryStep({
      stepId,
      modelOverride: modelOverride || undefined,
      reason: 'user_retry_from_console',
    })
  }

  const handleStoryToScriptStageSelect = (stageId: string) => {
    const currentActiveRawId = storyToScriptStream.activeStepId
    if (resolveStoryToScriptStageId(currentActiveRawId) === stageId && currentActiveRawId) {
      storyToScriptStream.selectStep(currentActiveRawId)
      return
    }
    const matched = storyToScriptStream.stages.find((stage) => resolveStoryToScriptStageId(stage.id) === stageId)
    if (matched) {
      storyToScriptStream.selectStep(matched.id)
    }
  }

  const handleOpenPromptEditor = async (stageId: StoryToScriptEditableStageId) => {
    setPromptEditorLoading(true)
    setPromptEditorError('')
    try {
      const response = await fetch(`/api/user/story-to-script-prompts/${stageId}?locale=${encodeURIComponent(locale)}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : t('runConsole.promptEditorLoadFailed'))
      }
      const nextEditor: PromptEditorState = {
        stageId,
        title: t(payload.titleKey || 'runConsole.storyToScript'),
        content: typeof payload.content === 'string' ? payload.content : '',
        source: payload.source === 'override' ? 'override' : 'default',
        filePath: typeof payload.filePath === 'string' ? payload.filePath : '',
        defaultFilePath: typeof payload.defaultFilePath === 'string' ? payload.defaultFilePath : '',
        overrideFilePath: typeof payload.overrideFilePath === 'string' ? payload.overrideFilePath : '',
      }
      setPromptEditor(nextEditor)
      setPromptEditorDraft(nextEditor.content)
    } catch (error) {
      setPromptEditorError(error instanceof Error ? error.message : t('runConsole.promptEditorLoadFailed'))
    } finally {
      setPromptEditorLoading(false)
    }
  }

  const handleSavePromptEditor = async () => {
    if (!promptEditor) return
    setPromptEditorSaving(true)
    setPromptEditorError('')
    try {
      const response = await fetch(`/api/user/story-to-script-prompts/${promptEditor.stageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale,
          content: promptEditorDraft,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : t('runConsole.promptEditorSaveFailed'))
      }
      setPromptEditor((current) => current ? {
        ...current,
        content: typeof payload.content === 'string' ? payload.content : promptEditorDraft,
        source: payload.source === 'override' ? 'override' : current.source,
        filePath: typeof payload.filePath === 'string' ? payload.filePath : current.filePath,
        defaultFilePath: typeof payload.defaultFilePath === 'string' ? payload.defaultFilePath : current.defaultFilePath,
        overrideFilePath: typeof payload.overrideFilePath === 'string' ? payload.overrideFilePath : current.overrideFilePath,
      } : current)
      setPromptEditorDraft(typeof payload.content === 'string' ? payload.content : promptEditorDraft)
      showToast(t('runConsole.promptEditorSaveSucceeded'), 'success')
    } catch (error) {
      setPromptEditorError(error instanceof Error ? error.message : t('runConsole.promptEditorSaveFailed'))
      return
    } finally {
      setPromptEditorSaving(false)
    }
  }

  const content = (
    <>
      {!hideMinimizedBadges && showStoryToScriptConsole && storyToScriptConsoleMinimized && storyToScriptActive && (
        <button
          type="button"
          onClick={() => onStoryToScriptMinimizedChange(false)}
          className="fixed right-6 bottom-6 z-120 glass-surface-modal rounded-2xl px-4 py-3 text-sm font-medium text-(--glass-tone-info-fg)"
        >
          {t('runConsole.storyToScriptRunning')}
        </button>
      )}

      {showStoryToScriptConsole && !storyToScriptConsoleMinimized && (
        <div className="fixed inset-0 z-120 glass-overlay backdrop-blur-sm">
          <div className="mx-auto mt-4 h-[calc(100vh-2rem)] w-[min(96vw,1400px)]">
            <LLMStageStreamCard
              title={storyToScriptCardTitle}
              subtitle={t('runConsole.storyToScriptSubtitle')}
              stages={storyToScriptStages}
              activeStageId={storyToScriptActiveAggregateStageId || storyToScriptStages[0]?.id || ''}
              selectedStageId={storyToScriptSelectedStageId || undefined}
              onSelectStage={handleStoryToScriptStageSelect}
              onRetryStage={(stepId) => {
                void handleRetryStepById(storyToScriptStream, stepId)
              }}
              outputText={storyToScriptStream.outputText}
              placeholderText={storyToScriptPendingStart ? t('runConsole.storyToScriptWaiting') : undefined}
              activeMessage={storyToScriptStream.activeMessage}
              overallProgress={storyToScriptStream.overallProgress}
              showCursor={storyToScriptShowCursor}
              autoScroll={storyToScriptSelectedStageId === storyToScriptActiveAggregateStageId}
              errorMessage={storyToScriptStream.errorMessage}
              renderStageActions={(stage) => {
                const editableStageId = resolveStoryToScriptStageId(stage.id)
                if (!editableStageId) {
                  return null
                }
                return (
                  <button
                    type="button"
                    onClick={() => {
                      void handleOpenPromptEditor(editableStageId)
                    }}
                    className="glass-btn-base glass-btn-secondary rounded-md px-2.5 py-1 text-[11px]"
                  >
                    {t('runConsole.editPrompt')}
                  </button>
                )
              }}
              topRightAction={(
                <div className="flex items-center gap-2">
                  {storyToScriptPendingStart && onStartStoryToScript && (
                    <button
                      type="button"
                      onClick={onStartStoryToScript}
                      className="glass-btn-base glass-btn-primary rounded-lg px-3 py-1.5 text-xs"
                    >
                      {t('runConsole.start')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={storyToScriptPendingStart
                      ? (onCancelStoryToScriptPendingStart || storyToScriptStream.reset)
                      : storyToScriptStream.reset}
                    className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs"
                  >
                    {t('runConsole.stop')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStoryToScriptMinimizedChange(true)}
                    className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs"
                  >
                    {t('runConsole.minimize')}
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {!hideMinimizedBadges && showScriptToStoryboardConsole && scriptToStoryboardConsoleMinimized && scriptToStoryboardActive && (
        <button
          type="button"
          onClick={() => onScriptToStoryboardMinimizedChange(false)}
          className="fixed right-6 bottom-20 z-120 glass-surface-modal rounded-2xl px-4 py-3 text-sm font-medium text-(--glass-tone-info-fg)"
        >
          {t('runConsole.scriptToStoryboardRunning')}
        </button>
      )}

      {showScriptToStoryboardConsole && !scriptToStoryboardConsoleMinimized && (
        <div className="fixed inset-0 z-120 glass-overlay backdrop-blur-sm">
          <div className="mx-auto mt-4 h-[calc(100vh-2rem)] w-[min(96vw,1400px)]">
            <LLMStageStreamCard
              title={scriptToStoryboardCardTitle}
              subtitle={t('runConsole.scriptToStoryboardSubtitle')}
              stages={scriptToStoryboardStages}
              activeStageId={scriptToStoryboardStream.activeStepId || scriptToStoryboardStages[scriptToStoryboardStages.length - 1]?.id || ''}
              selectedStageId={scriptToStoryboardStream.selectedStep?.id || undefined}
              onSelectStage={scriptToStoryboardStream.selectStep}
              onRetryStage={(stepId) => {
                void handleRetryStepById(scriptToStoryboardStream, stepId)
              }}
              outputText={scriptToStoryboardStream.outputText}
              activeMessage={scriptToStoryboardStream.activeMessage}
              overallProgress={scriptToStoryboardStream.overallProgress}
              showCursor={scriptToStoryboardShowCursor}
              autoScroll={scriptToStoryboardStream.selectedStep?.id === scriptToStoryboardStream.activeStepId}
              errorMessage={scriptToStoryboardStream.errorMessage}
              topRightAction={(
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={scriptToStoryboardStream.reset}
                    className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs"
                  >
                    {t('runConsole.stop')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onScriptToStoryboardMinimizedChange(true)}
                    className="glass-btn-base glass-btn-secondary rounded-lg px-3 py-1.5 text-xs"
                  >
                    {t('runConsole.minimize')}
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      )}

      <PromptTemplateModal
        isOpen={!!(promptEditor || promptEditorLoading || promptEditorError)}
        title={promptEditor?.title || t('runConsole.promptEditorTitle')}
        subtitle={t('runConsole.promptEditorSubtitle')}
        draft={promptEditorDraft}
        source={promptEditor?.source === 'override' ? 'override' : 'default'}
        filePath={promptEditor?.filePath || ''}
        loading={promptEditorLoading}
        saving={promptEditorSaving}
        error={promptEditorError}
        onChange={setPromptEditorDraft}
        onClose={() => {
          setPromptEditor(null)
          setPromptEditorDraft('')
          setPromptEditorError('')
        }}
        onSave={() => {
          void handleSavePromptEditor()
        }}
      />
    </>
  )

  if (typeof document === 'undefined') return content

  return createPortal(content, document.body)
}
