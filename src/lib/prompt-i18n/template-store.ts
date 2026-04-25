import fs from 'fs'
import path from 'path'
import { PROMPT_CATALOG } from './catalog'
import type { PromptId } from './prompt-ids'
import type { PromptLocale } from './types'
import { PromptI18nError } from './errors'

type PromptTemplateMeta = {
  content: string
  source: 'default' | 'override'
  filePath: string
  defaultFilePath: string
  overrideFilePath: string
}

function resolvePromptPaths(promptId: PromptId, locale: PromptLocale) {
  const entry = PROMPT_CATALOG[promptId]
  if (!entry) {
    throw new PromptI18nError(
      'PROMPT_ID_UNREGISTERED',
      promptId,
      `Prompt is not registered: ${promptId}`,
    )
  }
  const relativePath = `${entry.pathStem}.${locale}.txt`
  return {
    defaultFilePath: path.join(process.cwd(), 'lib', 'prompts', relativePath),
    overrideFilePath: path.join(process.cwd(), 'lib', 'prompts-overrides', relativePath),
  }
}

function readTemplateFromDisk(promptId: PromptId, locale: PromptLocale): PromptTemplateMeta {
  const { defaultFilePath, overrideFilePath } = resolvePromptPaths(promptId, locale)
  if (fs.existsSync(overrideFilePath)) {
    return {
      content: fs.readFileSync(overrideFilePath, 'utf-8'),
      source: 'override',
      filePath: overrideFilePath,
      defaultFilePath,
      overrideFilePath,
    }
  }
  try {
    return {
      content: fs.readFileSync(defaultFilePath, 'utf-8'),
      source: 'default',
      filePath: defaultFilePath,
      defaultFilePath,
      overrideFilePath,
    }
  } catch {
    throw new PromptI18nError(
      'PROMPT_TEMPLATE_NOT_FOUND',
      promptId,
      `Prompt template not found: ${defaultFilePath}`,
      { filePath: defaultFilePath, locale },
    )
  }
}

export function getPromptTemplateWithMeta(promptId: PromptId, locale: PromptLocale): PromptTemplateMeta {
  return readTemplateFromDisk(promptId, locale)
}

export function getPromptTemplate(promptId: PromptId, locale: PromptLocale): string {
  return readTemplateFromDisk(promptId, locale).content
}

export function savePromptTemplateOverride(promptId: PromptId, locale: PromptLocale, content: string): PromptTemplateMeta {
  const { overrideFilePath } = resolvePromptPaths(promptId, locale)
  fs.mkdirSync(path.dirname(overrideFilePath), { recursive: true })
  fs.writeFileSync(overrideFilePath, content, 'utf-8')
  return getPromptTemplateWithMeta(promptId, locale)
}

export function deletePromptTemplateOverride(promptId: PromptId, locale: PromptLocale) {
  const { overrideFilePath } = resolvePromptPaths(promptId, locale)
  if (fs.existsSync(overrideFilePath)) {
    fs.unlinkSync(overrideFilePath)
  }
}
