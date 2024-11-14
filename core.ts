import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process'

export function parseToSeconds(str: string): number {
  let parts = str.split(':')
  let h = +parts[0]
  let m = +parts[1]
  let s = +parts[2]
  return (h * 60 + m) * 60 + s
}

export type ScanVideoResult = {
  duration: string
  seconds: number
}

export function scanVideo(file: string) {
  return new Promise<ScanVideoResult>((resolve, reject) => {
    exec(`ffmpeg -i ${JSON.stringify(file)} 2>&1`, (err, stdout, stderr) => {
      let match = stdout.match(/Duration: ([0-9:.]+),/)
      if (match) {
        let duration = match[1]
        let seconds = parseToSeconds(duration)
        resolve({ duration, seconds })
        return
      }
      let error = new Error('failed to find video duration')
      error.cause = err
      Object.assign(error, { stdout })
      reject(error)
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
