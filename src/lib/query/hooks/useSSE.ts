'use client'
import { logError as _ulogError } from '@/lib/logging/core'

import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../keys'
import { TASK_EVENT_TYPE, TASK_SSE_EVENT_TYPE, type SSEEvent } from '@/lib/task/types'
import { applyTaskLifecycleToOverlay } from '../task-target-overlay'
import { isTaskIntent, resolveTaskIntent } from '@/lib/task/intent'

type UseSSEOptions = {
  projectId?: string | null
  episodeId?: string | null
  enabled?: boolean
  onEvent?: (event: SSEEvent) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BufferedEvent = { payload: any; raw: SSEEvent }

export function useSSE({ projectId, episodeId, enabled = true, onEvent }: UseSSEOptions) {
  const queryClient = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)
  const isGlobalAssetProject = projectId === 'global-asset-hub'

  const url = useMemo(() => {
    if (!projectId) return null
    const params = new URLSearchParams({ projectId })
    if (episodeId) params.set('episodeId', episodeId)
    return `/api/sse?${params}`
  }, [projectId, episodeId])

  useEffect(() => {
    if (!enabled || !url || !projectId) return

    // Capture narrowed value for use in nested functions
    const pid = projectId

    const source = new EventSource(url)
    sourceRef.current = source

    // ── Batch buffer for SSE events ──
    const buffer: BufferedEvent[] = []
    let flushTimer: number | null = null

    function scheduleFlush() {
      if (flushTimer !== null) return
      flushTimer = window.setTimeout(() => {
        flushTimer = null
        flush()
      }, 0)
    }

    function flush() {
      if (buffer.length === 0) return

      // Snapshot and clear
      const batch = buffer.splice(0)

      // ── 1. Fire onEvent for every event ──
      for (const { raw } of batch) {
        onEvent?.(raw)
      }

      // ── 2. Collect unique invalidation targets ──
      const tasksListInvalidated = new Set<string>()
      const targetStateScheduled = new Set<string>()
      const invalidatedTargets = new Set<string>()

      for (const { payload } of batch) {
        const eventType = payload.type as string
        const targetType = typeof payload.targetType === 'string'
          ? payload.targetType
          : typeof payload?.payload?.targetType === 'string'
            ? payload.payload.targetType
            : null
        const targetId = typeof payload.targetId === 'string'
          ? payload.targetId
          : typeof payload?.payload?.targetId === 'string'
            ? payload.payload.targetId
            : null
        const eventEpisodeId = typeof payload.episodeId === 'string'
          ? payload.episodeId
          : typeof payload?.payload?.episodeId === 'string'
            ? payload.payload.episodeId
            : null
        const resolvedEpisodeId = eventEpisodeId || episodeId || null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventPayload: any = payload?.payload && typeof payload.payload === 'object'
          ? payload.payload
          : null
        const lifecycleTypeValue = eventPayload?.lifecycleType
        const rawLifecycleType =
          eventType === TASK_SSE_EVENT_TYPE.LIFECYCLE
            ? typeof lifecycleTypeValue === 'string'
              ? lifecycleTypeValue
              : null
            : null
        const normalizedLifecycleType =
          rawLifecycleType === TASK_EVENT_TYPE.PROGRESS
            ? TASK_EVENT_TYPE.PROCESSING
            : rawLifecycleType

        // ── applyTaskLifecycleToOverlay: per-event, lightweight ──
        const payloadIntent = isTaskIntent(eventPayload?.intent)
          ? eventPayload.intent
          : resolveTaskIntent(typeof payload.taskType === 'string' ? payload.taskType : null)
        const payloadUi =
          eventPayload?.ui && typeof eventPayload.ui === 'object' && !Array.isArray(eventPayload.ui)
            ? (eventPayload.ui as Record<string, unknown>)
            : null
        const hasOutputAtStart =
          typeof payloadUi?.hasOutputAtStart === 'boolean'
            ? payloadUi.hasOutputAtStart
            : null

        applyTaskLifecycleToOverlay(queryClient, {
          projectId: pid,
          lifecycleType: normalizedLifecycleType,
          targetType,
          targetId,
          taskId: typeof payload.taskId === 'string' ? payload.taskId : null,
          taskType: typeof payload.taskType === 'string' ? payload.taskType : null,
          intent: payloadIntent,
          hasOutputAtStart,
          progress: typeof eventPayload?.progress === 'number' ? Math.floor(eventPayload.progress) : null,
          stage: typeof eventPayload?.stage === 'string' ? eventPayload.stage : null,
          stageLabel: typeof eventPayload?.stageLabel === 'string' ? eventPayload.stageLabel : null,
          eventTs: typeof payload.ts === 'string' ? payload.ts : null,
        })

        // ── Deduplicated invalidation scheduling ──
        const isLifecycleEvent = eventType === TASK_SSE_EVENT_TYPE.LIFECYCLE
        const shouldInvalidateTasksList =
          normalizedLifecycleType === TASK_EVENT_TYPE.CREATED ||
          normalizedLifecycleType === TASK_EVENT_TYPE.COMPLETED ||
          normalizedLifecycleType === TASK_EVENT_TYPE.FAILED ||
          (normalizedLifecycleType === TASK_EVENT_TYPE.PROCESSING &&
            typeof eventPayload?.progress !== 'number')
        const shouldInvalidateTargetStates =
          normalizedLifecycleType === TASK_EVENT_TYPE.COMPLETED ||
          normalizedLifecycleType === TASK_EVENT_TYPE.FAILED

        if (isLifecycleEvent && shouldInvalidateTasksList) {
          tasksListInvalidated.add(pid)
        }
        if (isLifecycleEvent && shouldInvalidateTargetStates) {
          targetStateScheduled.add(pid)
        }

        // Completed/Failed → invalidate by target (deduplicated)
        if (
          normalizedLifecycleType === TASK_EVENT_TYPE.COMPLETED ||
          normalizedLifecycleType === TASK_EVENT_TYPE.FAILED
        ) {
          const targetKey = `${targetType}:${resolvedEpisodeId}`
          if (!invalidatedTargets.has(targetKey)) {
            invalidatedTargets.add(targetKey)
            invalidateByTarget(targetType, resolvedEpisodeId)
          }
        }
      }

      // ── Batch-level: tasks list (once per flush) ──
      if (tasksListInvalidated.has(pid)) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(pid) })
      }

      // ── Batch-level: target states (debounced 800ms) ──
      if (targetStateScheduled.has(pid)) {
        targetStatesDebounce()
      }
    }

    // ── Debounce helper for target states ──
    let targetStatesTimer: number | null = null
    function targetStatesDebounce() {
      if (targetStatesTimer !== null) return
      targetStatesTimer = window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.targetStatesAll(pid), exact: false })
        targetStatesTimer = null
      }, 800)
    }

    function invalidateEpisodeScoped(resolvedEpisodeId: string | null) {
      if (!resolvedEpisodeId) return
      queryClient.invalidateQueries({ queryKey: queryKeys.episodeData(pid, resolvedEpisodeId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.storyboards.all(resolvedEpisodeId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.voiceLines.all(resolvedEpisodeId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.voiceLines.matched(pid, resolvedEpisodeId) })
    }

    function invalidateByTarget(targetType: string | null, resolvedEpisodeId: string | null) {
      if (isGlobalAssetProject) {
        if (targetType?.startsWith('GlobalCharacter')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.characters() })
          return
        }
        if (targetType?.startsWith('GlobalLocation')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.locations() })
          return
        }
        if (targetType?.startsWith('GlobalVoice')) {
          queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.voices() })
          return
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.all() })
        return
      }

      if (targetType === 'CharacterAppearance' || targetType === 'NovelPromotionCharacter') {
        queryClient.invalidateQueries({ queryKey: queryKeys.projectAssets.characters(pid) })
        queryClient.invalidateQueries({ queryKey: queryKeys.projectAssets.all(pid) })
        return
      }
      if (targetType === 'LocationImage' || targetType === 'NovelPromotionLocation') {
        queryClient.invalidateQueries({ queryKey: queryKeys.projectAssets.locations(pid) })
        queryClient.invalidateQueries({ queryKey: queryKeys.projectAssets.all(pid) })
        return
      }
      if (targetType === 'NovelPromotionVoiceLine') {
        invalidateEpisodeScoped(resolvedEpisodeId)
        return
      }
      if (
        targetType === 'NovelPromotionPanel' ||
        targetType === 'NovelPromotionStoryboard' ||
        targetType === 'NovelPromotionShot'
      ) {
        invalidateEpisodeScoped(resolvedEpisodeId)
        return
      }
      if (targetType === 'NovelPromotionEpisode') {
        invalidateEpisodeScoped(resolvedEpisodeId)
        queryClient.invalidateQueries({ queryKey: queryKeys.projectData(pid) })
        return
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.projectData(pid) })
    }

    // ── Incoming event handler: buffer only ──
    const handleEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        if (!payload || !payload.type) return
        buffer.push({ payload, raw: payload as SSEEvent })
        scheduleFlush()
      } catch (error) {
        _ulogError('[useSSE] failed to parse event', error)
      }
    }

    source.onmessage = handleEvent
    const namedEvents = [
      TASK_SSE_EVENT_TYPE.LIFECYCLE,
      TASK_SSE_EVENT_TYPE.STREAM,
    ] as const
    const listeners: Array<{ type: string; handler: EventListener }> = []
    for (const type of namedEvents) {
      const handler: EventListener = (event) => handleEvent(event as MessageEvent)
      source.addEventListener(type, handler)
      listeners.push({ type, handler })
    }
    source.onerror = (error) => {
      _ulogError('[useSSE] stream error', error)
    }

    return () => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer)
        flushTimer = null
      }
      if (targetStatesTimer !== null) {
        window.clearTimeout(targetStatesTimer)
        targetStatesTimer = null
      }
      for (const listener of listeners) {
        source.removeEventListener(listener.type, listener.handler)
      }
      source.close()
      sourceRef.current = null
    }
  }, [enabled, url, projectId, episodeId, queryClient, isGlobalAssetProject, onEvent])

  return {
    connected: !!sourceRef.current && sourceRef.current.readyState === EventSource.OPEN,
  }
}
