import { afterEach, describe, expect, it } from 'vitest'
import { PROMPT_IDS } from '@/lib/prompt-i18n'
import {
  deletePromptTemplateOverride,
  getPromptTemplateWithMeta,
  savePromptTemplateOverride,
} from '@/lib/prompt-i18n/template-store'

describe('prompt template store', () => {
  afterEach(() => {
    deletePromptTemplateOverride(PROMPT_IDS.NP_AGENT_CLIP, 'zh')
  })

  it('prefers local override files after saving one', () => {
    const original = getPromptTemplateWithMeta(PROMPT_IDS.NP_AGENT_CLIP, 'zh')
    const overrideContent = `${original.content}\n\n# override sentinel`

    const saved = savePromptTemplateOverride(PROMPT_IDS.NP_AGENT_CLIP, 'zh', overrideContent)
    const reloaded = getPromptTemplateWithMeta(PROMPT_IDS.NP_AGENT_CLIP, 'zh')

    expect(saved.source).toBe('override')
    expect(saved.content).toContain('# override sentinel')
    expect(saved.filePath).toBe(saved.overrideFilePath)
    expect(reloaded.source).toBe('override')
    expect(reloaded.content).toContain('# override sentinel')
    expect(reloaded.defaultFilePath).toBe(original.defaultFilePath)
  })
})
