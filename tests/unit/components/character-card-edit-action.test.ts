import * as React from 'react'
import { createElement } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import type { AbstractIntlMessages } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/query/mutations', () => ({
  useUploadProjectCharacterImage: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}))

vi.mock('@/components/media/MediaImageWithLoading', () => ({
  MediaImageWithLoading: (props: { alt?: string; containerClassName?: string; className?: string }) =>
    createElement('div', {
      'data-alt': props.alt,
      className: [props.containerClassName, props.className].filter(Boolean).join(' '),
    }),
}))

vi.mock('@/components/task/TaskStatusInline', () => ({
  __esModule: true,
  default: () => createElement('span', null, 'status'),
}))

vi.mock('@/components/task/TaskStatusOverlay', () => ({
  __esModule: true,
  default: () => createElement('div', null, 'overlay'),
}))

vi.mock('@/components/image-generation/ImageGenerationInlineCountButton', () => ({
  __esModule: true,
  default: () => createElement('button', null, 'count'),
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: (props: { name?: string; className?: string }) =>
    createElement('span', { 'data-icon': props.name, className: props.className }),
}))

vi.mock('@/components/ui/icons/AISparklesIcon', () => ({
  __esModule: true,
  default: (props: { className?: string }) => createElement('span', { 'data-ai-sparkles': true, className: props.className }),
}))

vi.mock('@/lib/task/presentation', () => ({
  resolveTaskPresentationState: () => null,
}))

vi.mock('@/lib/image-generation/use-image-generation-count', () => ({
  useImageGenerationCount: () => ({
    count: 3,
    setCount: vi.fn(),
  }),
}))

vi.mock('@/lib/image-generation/count', () => ({
  getImageGenerationCountOptions: () => [{ value: 3, label: '3' }],
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/VoiceSettings', () => ({
  __esModule: true,
  default: () => createElement('div', null, 'voice-settings'),
}))

const messages = {
  assets: {
    image: {
      edit: '编辑图片',
      generateCountPrefix: '生成',
      generateCountSuffix: '张',
      regenCountPrefix: '重新生成',
      regenerateStuck: '重新生成',
      selectCount: '选择数量',
      selectTip: '请选择一个形象',
      confirmOption: '确认方案 {number}',
      optionNumber: '方案 {number}',
      cancelSelection: '取消选择',
      useThis: '使用这个',
      upload: '上传',
      uploadReplace: '替换',
      undo: '撤回',
      optionSelected: '已选择方案 {number}',
      selectFirst: '请选择一个形象',
    },
    common: {
      generateFailed: '生成失败',
    },
    character: {
      edit: '编辑角色',
      delete: '删除角色',
      deleteOptions: '删除选项',
      deleteWhole: '删除整个角色',
      generateFromPrimary: '从主形象生成',
      primary: '主形象',
      secondary: '子形象',
      selectPrimaryFirst: '请先选择主形象',
    },
    location: {
      regenerateImage: '重新生成图片',
    },
    video: {
      panelCard: {
        editPrompt: '编辑提示词',
      },
    },
    characterProfile: {
      editGeneratePrompt: '编辑提示词',
    },
  },
} as const

function renderWithIntl(node: ReactElement) {
  const providerProps: ComponentProps<typeof NextIntlClientProvider> = {
    locale: 'zh',
    messages: messages as unknown as AbstractIntlMessages,
    timeZone: 'Asia/Shanghai',
    children: node,
  }

  return renderToStaticMarkup(createElement(NextIntlClientProvider, providerProps))
}

const baseCharacter = {
  id: 'character-1',
  name: '苏岑',
  introduction: null,
  customVoiceUrl: null,
  voiceType: null,
  voiceId: null,
  media: null,
  profileData: null,
  profileConfirmed: true,
  profileConfirmTaskRunning: false,
  appearances: [],
}

describe('CharacterCard edit actions', () => {
  it('labels the compact header pencil as character edit even for the primary appearance', async () => {
    Reflect.set(globalThis, 'React', React)
    const { default: CharacterCard } = await import('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/CharacterCard')

    const html = renderWithIntl(
      createElement(CharacterCard, {
        character: baseCharacter,
        appearance: {
          id: 'appearance-1',
          appearanceIndex: 0,
          changeReason: '初始形象',
          description: '角色描述',
          descriptions: null,
          imageUrl: 'https://example.com/character.png',
          media: null,
          imageUrls: ['https://example.com/character.png'],
          imageMedias: [],
          previousImageUrl: null,
          previousMedia: null,
          previousImageUrls: [],
          previousImageMedias: [],
          previousDescription: null,
          previousDescriptions: null,
          selectedIndex: null,
          imageTaskRunning: false,
          imageErrorMessage: null,
          lastError: null,
        },
        onEdit: () => undefined,
        onDelete: () => undefined,
        onRegenerate: () => undefined,
        onGenerate: () => undefined,
        onImageClick: () => undefined,
        showDeleteButton: true,
        isPrimaryAppearance: true,
        primaryAppearanceSelected: true,
        projectId: 'project-1',
        onEditGeneratePrompt: () => undefined,
      }),
    )

    expect(html).toContain('title="编辑角色"')
    expect(html).not.toContain('title="编辑提示词"')
  })

  it('keeps the multi-image generation prompt edit button available', async () => {
    Reflect.set(globalThis, 'React', React)
    const { default: CharacterCard } = await import('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/CharacterCard')

    const html = renderWithIntl(
      createElement(CharacterCard, {
        character: baseCharacter,
        appearance: {
          id: 'appearance-1',
          appearanceIndex: 0,
          changeReason: '初始形象',
          description: '角色描述',
          descriptions: ['角色描述 1', '角色描述 2', '角色描述 3'],
          imageUrl: null,
          media: null,
          imageUrls: [
            'https://example.com/character-1.png',
            'https://example.com/character-2.png',
            'https://example.com/character-3.png',
          ],
          imageMedias: [],
          previousImageUrl: null,
          previousMedia: null,
          previousImageUrls: [],
          previousImageMedias: [],
          previousDescription: null,
          previousDescriptions: null,
          selectedIndex: null,
          imageTaskRunning: false,
          imageErrorMessage: null,
          lastError: null,
        },
        onEdit: () => undefined,
        onDelete: () => undefined,
        onRegenerate: () => undefined,
        onGenerate: () => undefined,
        onImageClick: () => undefined,
        showDeleteButton: true,
        isPrimaryAppearance: true,
        primaryAppearanceSelected: true,
        projectId: 'project-1',
        onEditGeneratePrompt: () => undefined,
      }),
    )

    expect(html).toContain('title="编辑提示词"')
    expect(html).toContain('编辑提示词')
  })
})
