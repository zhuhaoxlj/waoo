import { PROMPT_IDS, type PromptId } from '@/lib/prompt-i18n/prompt-ids'

export type StoryToScriptEditableStageId =
  | 'analyze_characters'
  | 'analyze_locations'
  | 'analyze_props'
  | 'split_clips'
  | 'screenplay_conversion'

export type StoryToScriptEditableStageDef = {
  id: StoryToScriptEditableStageId
  titleKey: string
  promptId: PromptId
}

export const STORY_TO_SCRIPT_EDITABLE_STAGES: StoryToScriptEditableStageDef[] = [
  {
    id: 'analyze_characters',
    titleKey: 'progress.streamStep.analyzeCharacters',
    promptId: PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE,
  },
  {
    id: 'analyze_locations',
    titleKey: 'progress.streamStep.analyzeLocations',
    promptId: PROMPT_IDS.NP_SELECT_LOCATION,
  },
  {
    id: 'analyze_props',
    titleKey: 'progress.streamStep.analyzeProps',
    promptId: PROMPT_IDS.NP_SELECT_PROP,
  },
  {
    id: 'split_clips',
    titleKey: 'progress.streamStep.splitClips',
    promptId: PROMPT_IDS.NP_AGENT_CLIP,
  },
  {
    id: 'screenplay_conversion',
    titleKey: 'progress.streamStep.screenplayConversion',
    promptId: PROMPT_IDS.NP_SCREENPLAY_CONVERSION,
  },
]

export const STORY_TO_SCRIPT_EDITABLE_STAGE_MAP = new Map(
  STORY_TO_SCRIPT_EDITABLE_STAGES.map((stage) => [stage.id, stage]),
)

export function resolveStoryToScriptStageId(stepId: string | null | undefined): StoryToScriptEditableStageId | null {
  const trimmed = typeof stepId === 'string' ? stepId.trim() : ''
  if (!trimmed) return null
  if (trimmed.startsWith('screenplay_')) return 'screenplay_conversion'
  return STORY_TO_SCRIPT_EDITABLE_STAGE_MAP.has(trimmed as StoryToScriptEditableStageId)
    ? (trimmed as StoryToScriptEditableStageId)
    : null
}
