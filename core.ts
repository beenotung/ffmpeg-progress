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
  let ms = (seconds * 1000) % 1000
  return ms < 100
    ? `${d2(h)}:${d2(m)}:${d2(s)}.${d2(ms / 10)}`
    : `${d2(h)}:${d2(m)}:${d2(s)}.${ms}`
}

function d2(x: number) {
  if (x < 10) return '0' + x
  return x
}

export type ScanVideoResult = {
  /** @description e.g. "00:03:00.03" or "N/A" */
  duration: string
  /** @description e.g. 180.03 or 0 */
  seconds: number
  /** @description e.g. "4032x3024" */
  resolution: string
}

export function scanVideo(file: string) {
  return new Promise<ScanVideoResult>((resolve, reject) => {
    exec(`ffmpeg -i ${JSON.stringify(file)} 2>&1`, (err, stdout, stderr) => {
      try {
        // e.g. "  Duration: 00:03:00.03, start: 0.000000, bitrate: 2234 kb/s"
        // e.g. "  Duration: N/A, start: 0.000000, bitrate: N/A"
        let match = stdout.match(/Duration: ([0-9:.]+|N\/A),/)
        if (!match) {
          throw new Error('failed to find video duration')
        }
        let duration = match[1]
        let seconds = parseToSeconds(duration)

        // e.g. "  Stream #0:0[0x1](und): Video: h264 (Baseline) (avc1 / 0x31637661), yuvj420p(pc, progressive), 4032x3024, 2045 kb/s, 29.73 fps, 600 tbr, 600 tbn (default)"
        // e.g. "  Stream #0:0[0x1](eng): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt470bg/unknown/unknown, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 3958 kb/s, 29.49 fps, 29.83 tbr, 11456 tbn (default)"
        match = stdout.match(/Stream #0:\d.+: Video: .+ (\d+x\d+)[\s|,]/)
        if (!match) {
          throw new Error('failed to find video resolution')
        }
        let resolution = match[1]

        resolve({ duration, seconds, resolution })
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
