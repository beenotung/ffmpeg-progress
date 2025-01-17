import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process'

/** @description
 * from "00:01:00.03" to 60.03;
 * from "N/A" to NaN;
 * */
export function parseToSeconds(str: string): number {
  if (str == 'N/A') return NaN
  let parts = str.split(':')
  let h = +parts[0]
  let m = +parts[1]
  let s = +parts[2]
  return (h * 60 + m) * 60 + s
}

/** @description
 * from 60.03 to "00:01:00.03";
 * from 60.123 to "00:01:00.123";
 * from NaN to "N/A";
 * */
export function secondsToString(seconds: number): string {
  if (isNaN(seconds)) return 'N/A'
  let h = Math.floor(seconds / 3600)
  let m = Math.floor((seconds % 3600) / 60)
  let s = Math.floor(seconds % 60)

  // handle precision edge case, e.g. 60.1234 % 1 = 0.12339999999999662
  let ms: string
  let str = seconds.toString()
  if (str.includes('.')) {
    ms = str.split('.')[1]
  } else {
    ms = ''
  }

  if (!ms) {
    return `${d2(h)}:${d2(m)}:${d2(s)}`
  }

  return `${d2(h)}:${d2(m)}:${d2(s)}.${ms}`
}

function d2(x: number) {
  if (x < 10) return '0' + x
  return x
}

function format_ms(ms: number) {
  // round 0.123.39999999999418 to 0.123
  let seconds = ms / 1000
  let str = seconds.toFixed(3)
  seconds = +str
  ms = seconds * 1000

  if (ms < 10) return '00' + ms
  if (ms < 100) return '0' + ms
  return ms
}

export type ScanVideoResult = {
  /** @description e.g. "00:03:00.03" or "N/A" */
  duration: string
  /** @description e.g. 180.03 or 0 */
  seconds: number
  /** @description e.g. "4032x3024" */
  resolution: string | null
  /** @description e.g. 44100 for 44.1kHz */
  audioSampleRate: number | null
}

// e.g. "  Duration: 00:03:00.03, start: 0.000000, bitrate: 2234 kb/s"
// e.g. "  Duration: N/A, start: 0.000000, bitrate: N/A"
let duration_regex = /Duration: ([0-9:.]+|N\/A),/

// e.g. "  Stream #0:0[0x1](und): Video: h264 (Baseline) (avc1 / 0x31637661), yuvj420p(pc, progressive), 4032x3024, 2045 kb/s, 29.73 fps, 600 tbr, 600 tbn (default)"
// e.g. "  Stream #0:0[0x1](eng): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt470bg/unknown/unknown, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 3958 kb/s, 29.49 fps, 29.83 tbr, 11456 tbn (default)"
// e.g. "  Stream #0:1: Video: flv1 (flv), yuv420p, 1080x1920, 200 kb/s, 60 fps, 60 tbr, 1k tbn"
let resolution_regex = /Stream #0:\d[\w\[\]\(\)]*: Video: .+ (\d+x\d+)[\s|,]/

// e.g. "  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, stereo, fltp, 128 kb/s"
let audio_sample_rate_regex = /Stream #0:\d[\w\[\]\(\)]*: Audio: .+ (\d+) Hz/

export function parseVideoMetadata(stdout: string): ScanVideoResult {
  let lines = stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  let match = stdout.match(duration_regex)
  if (!match) {
    throw new Error('failed to find video duration')
  }
  let duration = match[1]
  let seconds = parseToSeconds(duration)

  let resolution = parseResolution(lines)
  let audioSampleRate = parseAudioSampleRate(lines)

  return { duration, seconds, resolution, audioSampleRate }
}

function parseResolution(lines: string[]): string | null {
  let has_video = lines.find(
    line => line.trim().startsWith('Stream #0:') && line.includes(' Video: '),
  )
  if (!has_video) return null

  let line = lines.find(line => resolution_regex.test(line))
  let match = line?.match(resolution_regex)!
  if (!match) {
    throw new Error('failed to find video resolution')
  }
  let resolution = match[1]
  return resolution
}

function parseAudioSampleRate(lines: string[]): number | null {
  let has_audio = lines.find(
    line => line.trim().startsWith('Stream #0:') && line.includes(' Audio: '),
  )
  if (!has_audio) return null
  let line = lines.find(line => audio_sample_rate_regex.test(line))
  let match = line?.match(audio_sample_rate_regex)!
  if (!match) {
    throw new Error('failed to find audio sample rate')
  }
  let audioSampleRate = +match[1]
  if (!audioSampleRate) {
    throw new Error(
      `failed to parse audio sample rate: ${JSON.stringify(match[1])}`,
    )
  }
  return audioSampleRate
}

export function scanVideo(file: string) {
  return new Promise<ScanVideoResult>((resolve, reject) => {
    exec(`ffmpeg -i ${JSON.stringify(file)} 2>&1`, (err, stdout, stderr) => {
      try {
        resolve(parseVideoMetadata(stdout))
      } catch (e) {
        let error = e instanceof Error ? e : new Error(String(e))
        if (err) {
          error.cause = err
        }
        Object.assign(error, { stdout })
        reject(error)
      }
    })
  })
}

export type ProgressArgs = {
  onData?: (chunk: Buffer) => void
  onDuration?: (duration: string) => void
  onTime?: (time: string) => void
  onProgress?: (args: OnProgressArgs) => void
}

export type OnProgressArgs = {
  deltaSeconds: number
  currentSeconds: number
  totalSeconds: number
  time: string
  duration: string
  abort: () => void
}

export async function convertFile(
  args: { inFile: string; outFile: string } & ProgressArgs,
) {
  let childProcess = spawn('ffmpeg', ['-y', '-i', args.inFile, args.outFile])
  return attachChildProcess({ childProcess, ...args })
}

export async function attachChildProcess(
  args: { childProcess: ChildProcessWithoutNullStreams } & ProgressArgs,
) {
  let { code, signal } = await new Promise<{
    code: number | null
    signal: NodeJS.Signals | null
  }>((resolve, reject) => {
    let { childProcess } = args
    let duration = ''
    let time = ''
    let totalSeconds = 0
    let lastSeconds = 0
    function abort() {
      childProcess.kill('SIGKILL')
    }
    if (args.onData) {
      childProcess.stdout.on('data', args.onData)
    }
    childProcess.stderr.on('data', (data: Buffer) => {
      let str = data.toString()
      let match = str.match(/Duration: ([0-9:.]+),/)
      if (match) {
        duration = match[1]
        totalSeconds = parseToSeconds(duration)
        if (args.onDuration) {
          args.onDuration(duration)
        }
        return
      }
      match = str.match(/frame=\s*\d+\s+fps=.*time=([0-9:.]+)\s/)
      if (match) {
        time = match[1]
        if (args.onTime) {
          args.onTime(time)
        }
        if (args.onProgress) {
          let currentSeconds = parseToSeconds(time)
          let deltaSeconds = currentSeconds - lastSeconds
          lastSeconds = currentSeconds
          args.onProgress({
            deltaSeconds,
            currentSeconds,
            totalSeconds,
            time,
            duration,
            abort,
          })
        }
      }
    })
    childProcess.on('exit', (code, signal) => {
      resolve({ code, signal })
    })
  })
  if (code == 0) return
  throw new Error(
    `ffmpeg exit abnormally, exit code: ${code}, signal: ${signal}`,
  )
}

export function estimateOutSize(args: {
  inSize: number
  currentOutSize: number
  currentSeconds: number
  totalSeconds: number
}) {
  let estimatedRate = args.currentOutSize / args.currentSeconds
  let remindSeconds = args.totalSeconds - args.currentSeconds
  let estimatedOutSize = args.currentOutSize + estimatedRate * remindSeconds
  return estimatedOutSize
}
