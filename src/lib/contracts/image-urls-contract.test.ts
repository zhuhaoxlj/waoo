import { describe, expect, it } from 'vitest'
import {
  ImageUrlsContractError,
  decodeImageUrlsFromDb,
  decodeImageUrlsStrict,
  encodeImageUrls,
} from './image-urls-contract'

describe('image-urls-contract', () => {
  it('encodeImageUrls returns JSON array string', () => {
    const encoded = encodeImageUrls(['a', 'b'])
    expect(encoded).toBe('["a","b"]')
  })

  it('decodeImageUrlsStrict parses valid JSON array', () => {
    const decoded = decodeImageUrlsStrict('["a","b"]')
    expect(decoded).toEqual(['a', 'b'])
  })

  it('decodeImageUrlsStrict throws on invalid JSON', () => {
    expect(() => decodeImageUrlsStrict('not-json')).toThrow(ImageUrlsContractError)
  })

  it('decodeImageUrlsStrict throws on non-array JSON', () => {
    expect(() => decodeImageUrlsStrict('{"a":1}')).toThrow(ImageUrlsContractError)
  })

  it('decodeImageUrlsStrict throws on non-string array entry', () => {
    expect(() => decodeImageUrlsStrict('["a",1]')).toThrow(ImageUrlsContractError)
  })

  it('decodeImageUrlsFromDb throws on null', () => {
    expect(() => decodeImageUrlsFromDb(null)).toThrow(ImageUrlsContractError)
  })
})
