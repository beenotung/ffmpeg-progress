import { expect } from 'chai'
import { parseVideoMetadata } from './core'

describe('parseVideoMetadata', () => {
  let duration_line =
    '  Duration: 00:03:00.03, start: 0.000000, bitrate: 2234 kb/s'
  let resolution_line =
    '  Stream #0:0[0x1](und): Video: h264 (Baseline) (avc1 / 0x31637661), yuvj420p(pc, progressive), 4032x3024, 2045 kb/s, 29.73 fps, 600 tbr, 600 tbn (default)'

  describe('duration', () => {
    it('should parse valid duration', () => {
      let stdout = `
  Duration: 00:03:00.03, start: 0.000000, bitrate: 2234 kb/s
${resolution_line}
`
      let metadata = parseVideoMetadata(stdout)
      expect(metadata.duration).to.equals('00:03:00.03')
      expect(metadata.seconds).to.equals(180.03)
    })
    it('should parse invalid duration', () => {
      let stdout = `
  Duration: N/A, start: 0.000000, bitrate: N/A
${resolution_line}
`
      let metadata = parseVideoMetadata(stdout)
      expect(metadata.duration).to.equals('N/A')
      expect(metadata.seconds).to.be.NaN
    })
  })

  describe('resolution', () => {
    it('should parse resolution in the first stream', () => {
      let stdout = `
${duration_line}
  Stream #0:0[0x1](und): Video: h264 (Baseline) (avc1 / 0x31637661), yuvj420p(pc, progressive), 4032x3024, 2045 kb/s, 29.73 fps, 600 tbr, 600 tbn (default)
`
      let metadata = parseVideoMetadata(stdout)
      expect(metadata.resolution).to.equals('4032x3024')
    })
    it('should parse resolution in the second stream', () => {
      let stdout = `
${duration_line}
  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, stereo, fltp, 128 kb/s
  Stream #0:1: Video: flv1 (flv), yuv420p, 1080x1920, 200 kb/s, 60 fps, 60 tbr, 1k tbn
`
      let metadata = parseVideoMetadata(stdout)
      expect(metadata.resolution).to.equals('1080x1920')
    })
  })
})
