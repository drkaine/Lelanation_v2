import { describe, expect, it } from 'vitest'
import { parseShardList } from '../parseShardList.js'

describe('parseShardList', () => {
  it('parses underscore-separated shard_list from DB', () => {
    expect(parseShardList('5008_5005_5001')).toEqual([5008, 5005, 5001])
  })

  it('parses comma-separated legacy values', () => {
    expect(parseShardList('5008,5005,5001')).toEqual([5008, 5005, 5001])
  })

  it('returns empty for null or blank', () => {
    expect(parseShardList(null)).toEqual([])
    expect(parseShardList('')).toEqual([])
  })
})
