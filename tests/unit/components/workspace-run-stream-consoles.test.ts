import * as React from 'react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import WorkspaceRunStreamConsoles from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/WorkspaceRunStreamConsoles'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh',
}))

vi.mock('@/components/llm-console/LLMStageStreamCard', () => ({
  __esModule: true,
  default: ({
    title,
    stages,
    placeholderText,
    topRightAction,
    renderStageActions,
  }: {
    title: string
    stages: Array<{ id: string; title: string }>
    placeholderText?: string
    topRightAction?: React.ReactNode
    renderStageActions?: (stage: { id: string; title: string }) => React.ReactNode
  }) => createElement(
    'section',
    null,
    `LLMStageStreamCard:${title}:${placeholderText || ''}`,
    stages.map((stage) => createElement('div', { key: stage.id }, `${stage.id}:${stage.title}`, renderStageActions?.(stage))),
    topRightAction,
  ),
}))

function createStreamState(overrides?: Partial<React.ComponentProps<typeof WorkspaceRunStreamConsoles>['storyToScriptStream']>) {
  return {
    status: 'running' as const,
    isVisible: true,
    isRecoveredRunning: true,
    stages: [],
    selectedStep: null,
    activeStepId: null,
    outputText: '',
    activeMessage: '',
    overallProgress: 0,
    isRunning: false,
    errorMessage: '',
    stop: () => undefined,
    reset: () => undefined,
    selectStep: () => undefined,
    retryStep: async () => ({
      runId: 'run-1',
      status: 'running',
      summary: null,
      payload: null,
      errorMessage: '',
    }),
    ...overrides,
  }
}

describe('WorkspaceRunStreamConsoles', () => {
  it('shows fallback running console when a recovered run has no stages yet', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      createElement(WorkspaceRunStreamConsoles, {
        storyToScriptStream: createStreamState(),
        scriptToStoryboardStream: createStreamState({
          status: 'idle',
          isVisible: false,
          isRecoveredRunning: false,
        }),
        storyToScriptConsoleMinimized: false,
        scriptToStoryboardConsoleMinimized: true,
        onStoryToScriptMinimizedChange: () => undefined,
        onScriptToStoryboardMinimizedChange: () => undefined,
      }),
    )

    expect(html).toContain('LLMStageStreamCard:runConsole.storyToScript')
  })

  it('shows start action when story-to-script is pending manual start', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      createElement(WorkspaceRunStreamConsoles, {
        storyToScriptStream: createStreamState({
          status: 'idle',
          isVisible: false,
          isRecoveredRunning: false,
        }),
        scriptToStoryboardStream: createStreamState({
          status: 'idle',
          isVisible: false,
          isRecoveredRunning: false,
        }),
        storyToScriptPendingStart: true,
        storyToScriptConsoleMinimized: false,
        scriptToStoryboardConsoleMinimized: true,
        onStartStoryToScript: () => undefined,
        onCancelStoryToScriptPendingStart: () => undefined,
        onStoryToScriptMinimizedChange: () => undefined,
        onScriptToStoryboardMinimizedChange: () => undefined,
      }),
    )

    expect(html).toContain('runConsole.start')
    expect(html).toContain('runConsole.storyToScriptWaiting')
    expect(html).toContain('analyze_characters:progress.streamStep.analyzeCharacters')
    expect(html).toContain('analyze_locations:progress.streamStep.analyzeLocations')
    expect(html).toContain('analyze_props:progress.streamStep.analyzeProps')
    expect(html).toContain('split_clips:progress.streamStep.splitClips')
    expect(html).toContain('screenplay_conversion:progress.streamStep.screenplayConversion')
    expect(html).toContain('runConsole.editPrompt')
  })

  it('keeps console mounted while story-to-script is launching before stream becomes visible', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      createElement(WorkspaceRunStreamConsoles, {
        storyToScriptStream: createStreamState({
          status: 'idle',
          isVisible: false,
          isRecoveredRunning: false,
        }),
        scriptToStoryboardStream: createStreamState({
          status: 'idle',
          isVisible: false,
          isRecoveredRunning: false,
        }),
        storyToScriptPendingStart: false,
        storyToScriptLaunching: true,
        storyToScriptConsoleMinimized: false,
        scriptToStoryboardConsoleMinimized: true,
        onStartStoryToScript: () => undefined,
        onCancelStoryToScriptPendingStart: () => undefined,
        onStoryToScriptMinimizedChange: () => undefined,
        onScriptToStoryboardMinimizedChange: () => undefined,
      }),
    )

    expect(html).toContain('LLMStageStreamCard:runConsole.storyToScript')
  })
})
