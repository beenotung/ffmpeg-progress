import { expect } from 'chai'
import {
  getVideoDuration,
  getVideoResolution,
  parseToSeconds,
  parseVideoMetadata,
  secondsToString,
} from './core'

describe('seconds parsing', () => {
  it('should parse "00:01:00.03" to 60.03', () => {
    expect(parseToSeconds('00:01:00.03')).to.equal(60.03)
  })
  it('should parse "N/A" to NaN', () => {
    expect(parseToSeconds('N/A')).to.be.NaN
  })
})

describe('convert seconds to string', () => {
  it('should convert 60 to "00:01:00"', () => {
    expect(secondsToString(60)).to.equal('00:01:00')
  })
  it('should convert 60.03 to "00:01:00.03"', () => {
    expect(secondsToString(60.03)).to.equal('00:01:00.03')
  })
  it('should convert 60.123 to "00:01:00.123"', () => {
    expect(secondsToString(60.123)).to.equal('00:01:00.123')
  })
  it('should not have decimal part in ms', () => {
    // 60.1234 % 1 = 0.12339999999999662
    expect(secondsToString(60.1234)).to.equal('00:01:00.1234')
  })
  it('should convert NaN to "N/A"', () => {
    expect(secondsToString(NaN)).to.equal('N/A')
  })
})

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
    it('should skip resolution for audio file', () => {
      let stdout = `
${duration_line}
  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, stereo, fltp, 128 kb/s
`
      let metadata = parseVideoMetadata(stdout)
      expect(metadata.resolution).to.be.null
    })
  })

  describe('audio sample rate', () => {
    it('should parse audio sample rate', () => {
      let stdout = `
${duration_line}
  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, stereo, fltp, 128 kb/s
`
      let metadata = parseVideoMetadata(stdout)
      expect(metadata.audioSampleRate).to.equal(44100)
    })
    it('should skip audio sample rate for video file', () => {
      let stdout = `
${duration_line}
  Stream #0:0[0x1](und): Video: h264 (Baseline) (avc1 / 0x31637661), yuvj420p(pc, progressive), 4032x3024, 2045 kb/s, 29.73 fps, 600 tbr, 600 tbn (default)
`
      let metadata = parseVideoMetadata(stdout)
      expect(metadata.audioSampleRate).to.be.null
    })
  })
})

describe('getVideoResolution', () => {
  it('should get rotated video resolution', async () => {
    let size = await getVideoResolution('test/in.mp4')
    expect(size).to.deep.equal({ width: 848, height: 480 })

    size = await getVideoResolution('test/rotate.mp4')
    expect(size).to.deep.equal({ width: 480, height: 848 })
  })
})

describe('getVideoDuration', () => {
  it('should get video duration', async () => {
    let duration = await getVideoDuration('test/in.mp4')
    expect(duration).to.equal(23.4)

    duration = await getVideoDuration('test/rotate.mp4')
    expect(duration).to.equal(23.4)
  })
})
