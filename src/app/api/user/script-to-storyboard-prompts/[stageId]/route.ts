import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import type { PromptLocale } from '@/lib/prompt-i18n'
import {
  getPromptTemplateWithMeta,
  savePromptTemplateOverride,
} from '@/lib/prompt-i18n/template-store'
import {
  SCRIPT_TO_STORYBOARD_EDITABLE_STAGE_MAP,
  type ScriptToStoryboardEditableStageId,
} from '@/lib/novel-promotion/script-to-storyboard-stage-prompts'

function parseStageId(value: string): ScriptToStoryboardEditableStageId {
  const trimmed = value.trim() as ScriptToStoryboardEditableStageId
  if (!SCRIPT_TO_STORYBOARD_EDITABLE_STAGE_MAP.has(trimmed)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'INVALID_STAGE_ID',
      field: 'stageId',
      message: 'stageId is not supported',
    })
  }
  return trimmed
}

function parseLocale(value: string | null): PromptLocale {
  if (value === 'zh' || value === 'en') return value
  throw new ApiError('INVALID_PARAMS', {
    code: 'INVALID_LOCALE',
    field: 'locale',
    message: 'locale must be zh or en',
  })
}

export const GET = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ stageId: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const { stageId: rawStageId } = await context.params
  const stageId = parseStageId(rawStageId)
  const locale = parseLocale(request.nextUrl.searchParams.get('locale'))
  const stage = SCRIPT_TO_STORYBOARD_EDITABLE_STAGE_MAP.get(stageId)!
  const template = getPromptTemplateWithMeta(stage.promptId, locale)

  return NextResponse.json({
    stageId,
    promptId: stage.promptId,
    locale,
    titleKey: stage.titleKey,
    content: template.content,
    source: template.source,
    filePath: template.filePath,
    defaultFilePath: template.defaultFilePath,
    overrideFilePath: template.overrideFilePath,
  })
})

export const PUT = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ stageId: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const { stageId: rawStageId } = await context.params
  const stageId = parseStageId(rawStageId)
  const body = await request.json()
  const locale = parseLocale(typeof body?.locale === 'string' ? body.locale : null)
  const content = typeof body?.content === 'string' ? body.content : ''
  if (!content.trim()) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'EMPTY_PROMPT_TEMPLATE',
      field: 'content',
      message: 'content is required',
    })
  }

  const stage = SCRIPT_TO_STORYBOARD_EDITABLE_STAGE_MAP.get(stageId)!
  const saved = savePromptTemplateOverride(stage.promptId, locale, content)

  return NextResponse.json({
    ok: true,
    stageId,
    promptId: stage.promptId,
    locale,
    source: saved.source,
    content: saved.content,
    filePath: saved.filePath,
    defaultFilePath: saved.defaultFilePath,
    overrideFilePath: saved.overrideFilePath,
  })
})
