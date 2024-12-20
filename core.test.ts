import { expect } from 'chai'
import { parseToSeconds, secondsToString } from './core'

describe('seconds parsing', () => {
  it('should parse "00:01:00.03" to 60.03', () => {
    expect(parseToSeconds('00:01:00.03')).to.equal(60.03)
  })
  it('should parse "N/A" to NaN', () => {
    expect(parseToSeconds('N/A')).to.be.NaN
  })
})

describe('seconds to string', () => {
  it('should parse 60.03 to "00:01:00.03"', () => {
    expect(secondsToString(60.03)).to.equal('00:01:00.03')
  })
  it('should parse 60.123 to "00:01:00.123"', () => {
    expect(secondsToString(60.123)).to.equal('00:01:00.123')
  })
  it('should parse NaN to "N/A"', () => {
    expect(secondsToString(NaN)).to.equal('N/A')
  })
})
