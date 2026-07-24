import { describe, it, expect } from 'vitest'
import { toLocalFileUrl, fromLocalFileUrl } from '../src/main/utils/localfile'

describe('localfile URL round-trip', () => {
  it('survives a plain Windows path', () => {
    const path = 'C:/Users/Photos/2024/April/IMG_0001.jpg'
    expect(fromLocalFileUrl(toLocalFileUrl(path))).toBe(path)
  })

  it('normalizes backslashes to forward slashes', () => {
    expect(fromLocalFileUrl(toLocalFileUrl('C:\\Photos\\IMG.jpg'))).toBe('C:/Photos/IMG.jpg')
  })

  it('survives spaces and special characters', () => {
    const path = 'D:/My Photos/trip #2/what?.jpg'
    expect(fromLocalFileUrl(toLocalFileUrl(path))).toBe(path)
  })

  it('produces a URL the WHATWG parser accepts', () => {
    const url = toLocalFileUrl('C:/Users/Photos/IMG_0001.jpg')
    expect(() => new URL(url)).not.toThrow()
    expect(new URL(url).protocol).toBe('localfile:')
  })
})
