import { beforeEach, describe, expect, it, vi } from 'vitest'

const queueCtorMock = vi.hoisted(() =>
  vi.fn((name: string, options: Record<string, unknown>): Record<string, unknown> => ({
    name,
    options,
    add: vi.fn(),
    getJob: vi.fn(async () => null),
  })),
)

const queueRedisMock = vi.hoisted(() => ({ scope: 'queue-redis' }))

vi.mock('bullmq', () => ({
  Queue: queueCtorMock,
}))

vi.mock('@/lib/redis', () => ({
  queueRedis: queueRedisMock,
}))

describe('task queues', () => {
  beforeEach(() => {
    vi.resetModules()
    queueCtorMock.mockClear()
  })

  it('creates queues lazily and reuses same queue per type', async () => {
    const { getQueueByType, QUEUE_NAME } = await import('@/lib/task/queues')

    expect(queueCtorMock).not.toHaveBeenCalled()

    const imageQueueA = getQueueByType('image')

    expect(queueCtorMock).toHaveBeenCalledTimes(1)
    expect(queueCtorMock).toHaveBeenCalledWith(QUEUE_NAME.IMAGE, expect.objectContaining({
      connection: queueRedisMock,
    }))

    const imageQueueB = getQueueByType('image')

    expect(imageQueueB).toBe(imageQueueA)
    expect(queueCtorMock).toHaveBeenCalledTimes(1)

    const textQueue = getQueueByType('text')

    expect(textQueue).not.toBe(imageQueueA)
    expect(queueCtorMock).toHaveBeenCalledTimes(2)
    expect(queueCtorMock).toHaveBeenLastCalledWith(QUEUE_NAME.TEXT, expect.objectContaining({
      connection: queueRedisMock,
    }))
  })

  it('scans lazily created queues when removing task jobs', async () => {
    const { removeTaskJob, QUEUE_NAME } = await import('@/lib/task/queues')

    const removeMock = vi.fn(async () => undefined)
    const getJobMocks = [
      vi.fn(async () => null),
      vi.fn(async () => ({ remove: removeMock })),
      vi.fn(async () => null),
      vi.fn(async () => null),
    ]
    const createdQueues: Array<{ getJob: ReturnType<typeof vi.fn> }> = []

    queueCtorMock.mockImplementation((name: string, options: Record<string, unknown>): Record<string, unknown> => ({
      name,
      options,
      add: vi.fn(),
      getJob: (() => {
        const getJob = getJobMocks[createdQueues.length] ?? vi.fn(async () => null)
        createdQueues.push({ getJob })
        return getJob
      })(),
    }))

    const removed = await removeTaskJob('task-123')

    expect(removed).toBe(true)
    expect(queueCtorMock).toHaveBeenCalledTimes(4)
    expect(queueCtorMock.mock.calls.map((call) => call[0])).toEqual([
      QUEUE_NAME.IMAGE,
      QUEUE_NAME.VIDEO,
      QUEUE_NAME.VOICE,
      QUEUE_NAME.TEXT,
    ])
    expect(getJobMocks[0]).toHaveBeenCalledWith('task-123')
    expect(getJobMocks[1]).toHaveBeenCalledWith('task-123')
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
})
