import { PROMPT_IDS, type PromptId } from '@/lib/prompt-i18n/prompt-ids'

export type ScriptToStoryboardEditableStageId =
  | 'storyboard_plan'
  | 'cinematography_rules'
  | 'acting_direction'
  | 'storyboard_detail_refine'
  | 'voice_analyze'

export type ScriptToStoryboardEditableStageDef = {
  id: ScriptToStoryboardEditableStageId
  titleKey: string
  promptId: PromptId
}

export const SCRIPT_TO_STORYBOARD_EDITABLE_STAGES: ScriptToStoryboardEditableStageDef[] = [
  {
    id: 'storyboard_plan',
    titleKey: 'progress.streamStep.storyboardPlan',
    promptId: PROMPT_IDS.NP_AGENT_STORYBOARD_PLAN,
  },
  {
    id: 'cinematography_rules',
    titleKey: 'progress.streamStep.cinematographyRules',
    promptId: PROMPT_IDS.NP_AGENT_CINEMATOGRAPHER,
  },
  {
    id: 'acting_direction',
    titleKey: 'progress.streamStep.actingDirection',
    promptId: PROMPT_IDS.NP_AGENT_ACTING_DIRECTION,
  },
  {
    id: 'storyboard_detail_refine',
    titleKey: 'progress.streamStep.storyboardDetailRefine',
    promptId: PROMPT_IDS.NP_AGENT_STORYBOARD_DETAIL,
  },
  {
    id: 'voice_analyze',
    titleKey: 'progress.streamStep.voiceAnalyze',
    promptId: PROMPT_IDS.NP_VOICE_ANALYSIS,
  },
]

export const SCRIPT_TO_STORYBOARD_EDITABLE_STAGE_MAP = new Map(
  SCRIPT_TO_STORYBOARD_EDITABLE_STAGES.map((stage) => [stage.id, stage]),
)

export function resolveScriptToStoryboardStageId(stepId: string | null | undefined): ScriptToStoryboardEditableStageId | null {
  const trimmed = typeof stepId === 'string' ? stepId.trim() : ''
  if (!trimmed) return null
  if (trimmed === 'voice_analyze') return 'voice_analyze'
  if (trimmed.includes('_phase1')) return 'storyboard_plan'
  if (trimmed.includes('_phase2_cinematography')) return 'cinematography_rules'
  if (trimmed.includes('_phase2_acting')) return 'acting_direction'
  if (trimmed.includes('_phase3_detail')) return 'storyboard_detail_refine'
  return SCRIPT_TO_STORYBOARD_EDITABLE_STAGE_MAP.has(trimmed as ScriptToStoryboardEditableStageId)
    ? (trimmed as ScriptToStoryboardEditableStageId)
    : null
}
