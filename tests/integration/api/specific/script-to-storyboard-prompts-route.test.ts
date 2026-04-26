import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callRoute } from '../helpers/call-route'

const authMock = vi.hoisted(() => ({
  requireUserAuth: vi.fn(async () => ({
    session: {
      user: { id: 'user-1' },
    },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const templateStoreMock = vi.hoisted(() => ({
  getPromptTemplateWithMeta: vi.fn(() => ({
    content: 'default storyboard template content',
    source: 'default' as const,
    filePath: '/repo/lib/prompts/novel-promotion/agent_storyboard_plan.zh.txt',
    defaultFilePath: '/repo/lib/prompts/novel-promotion/agent_storyboard_plan.zh.txt',
    overrideFilePath: '/repo/lib/prompts-overrides/novel-promotion/agent_storyboard_plan.zh.txt',
  })),
  savePromptTemplateOverride: vi.fn((_promptId: string, _locale: string, content: string) => ({
    content,
    source: 'override' as const,
    filePath: '/repo/lib/prompts-overrides/novel-promotion/agent_storyboard_plan.zh.txt',
    defaultFilePath: '/repo/lib/prompts/novel-promotion/agent_storyboard_plan.zh.txt',
    overrideFilePath: '/repo/lib/prompts-overrides/novel-promotion/agent_storyboard_plan.zh.txt',
  })),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prompt-i18n/template-store', () => templateStoreMock)

describe('api specific - script to storyboard prompts route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns effective prompt content for a supported stage', async () => {
    const route = await import('@/app/api/user/script-to-storyboard-prompts/[stageId]/route')

    const res = await callRoute(
      route.GET,
      'GET',
      undefined,
      {
        params: { stageId: 'storyboard_plan' },
        query: { locale: 'zh' },
      },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { stageId: string; promptId: string; locale: string; content: string }
    expect(body.stageId).toBe('storyboard_plan')
    expect(body.locale).toBe('zh')
    expect(body.content).toBe('default storyboard template content')
    expect(templateStoreMock.getPromptTemplateWithMeta).toHaveBeenCalledTimes(1)
  })

  it('saves override content for a supported stage', async () => {
    const route = await import('@/app/api/user/script-to-storyboard-prompts/[stageId]/route')

    const res = await callRoute(
      route.PUT,
      'PUT',
      {
        locale: 'zh',
        content: 'user storyboard override content',
      },
      {
        params: { stageId: 'storyboard_plan' },
      },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; source: string; content: string }
    expect(body.ok).toBe(true)
    expect(body.source).toBe('override')
    expect(body.content).toBe('user storyboard override content')
    expect(templateStoreMock.savePromptTemplateOverride).toHaveBeenCalledWith(
      'np_agent_storyboard_plan',
      'zh',
      'user storyboard override content',
    )
  })

  it('rejects unsupported stage ids', async () => {
    const route = await import('@/app/api/user/script-to-storyboard-prompts/[stageId]/route')

    const res = await callRoute(
      route.GET,
      'GET',
      undefined,
      {
        params: { stageId: 'unsupported_stage' },
        query: { locale: 'zh' },
      },
    )

    expect(res.status).toBe(400)
  })
})
