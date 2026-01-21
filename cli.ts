import { spawn } from 'child_process'
import {
  attachChildProcess,
  attachStream,
  OnProgressArgs,
  secondsToString,
} from './core'

let args = process.argv.slice(2)
let custom_args: string[] = []

let verbose = false

for (let arg of args) {
  if (arg == '-h' || arg == '--help') {
    console.log(
      `
ffmpeg-progress - A progress monitor for FFmpeg operations

USAGE:
  ffmpeg-progress <option>
  ffmpeg-progress <ffmpeg-args...>
  ffmpeg <ffmpeg-args...> 2>&1 | ffmpeg-progress

EXAMPLES:
  # as drop-in replacement for ffmpeg:
  ffmpeg-progress -i input.mp4 -c:v libx264 output.mp4

  # pipe from ffmpeg output (need to redirect stderr):
  ffmpeg -i input.mp4 -c:v libx264 output.mp4 2>&1 | ffmpeg-progress

  # using calling other script that use ffmpeg indirectly
  to-mp4 --auto-name input.mov | ffmpeg-progress

OPTIONS:
  -h, --help     show this help message and exit
  --version      show version and exit
  --verbose      verbose mode

NOTES:
  - Pipe mode requires redirecting ffmpeg stderr to stdout (2>&1)
  - Wrapped mode automatically captures ffmpeg progress from stderr
  - ffmpeg outputs progress information to stderr, not stdout
`.trim(),
    )
    process.exit(0)
  }
  if (arg == '-version' || arg == '--version') {
    let pkg = require('./package.json')
    console.log(`ffmpeg-progress ${pkg.version}`)
    process.exit(0)
  }
  if (arg == '--verbose') {
    verbose = true
    custom_args.push(arg)
    continue
  }
}

args = args.filter(arg => !custom_args.includes(arg))

let errorLines: string[] = []
function checkOverwrite(chunk: Buffer) {
  let str = chunk.toString()
  if (str.includes('Overwrite?')) {
    console.error(str)
    return
  }
  errorLines.push(str)
}

function f(time: number) {
  return secondsToString(Math.round(time))
}

let lastMessageLength = 0
function writeProgress(message: string) {
  let output = '\r' + message.padEnd(lastMessageLength, ' ')
  lastMessageLength = message.length
  process.stdout.write(output)
}

let startTime = 0
function onProgress(args: OnProgressArgs) {
  startTime ||= Date.now()
  let passedTime = Date.now() - startTime
  let progress = `${f(args.currentSeconds)}/${f(args.totalSeconds)}`
  let speed = (args.currentSeconds / (passedTime / 1000)).toFixed(1)
  let elapsed = f(passedTime / 1000)
  let eta = f(
    (args.totalSeconds - args.currentSeconds) /
      (args.currentSeconds / (passedTime / 1000)),
  )
  writeProgress(
    `progress=${progress} speed=${speed}x elapsed=${elapsed} eta=${eta}`,
  )
}

function timestamp() {
  let date = new Date()
  let y = date.getFullYear()
  let m = (date.getMonth() + 1).toString().padStart(2, '0')
  let d = date.getDate().toString().padStart(2, '0')
  let H = date.getHours().toString().padStart(2, '0')
  let M = date.getMinutes().toString().padStart(2, '0')
  let S = date.getSeconds().toString().padStart(2, '0')
  return `${y}-${m}-${d} ${H}:${M}:${S}`
}

function logVerbose(message: string) {
  console.log(`[${timestamp()}] ${message}`)
}

if (args.length == 0) {
  if (verbose) {
    logVerbose('reading ffmpeg output from pipe...')
  } else {
    writeProgress('reading ffmpeg output from pipe...')
  }
  attachStream({
    stream: process.stdin,
    onData: checkOverwrite,
    onProgress,
  }).on('end', () => {
    process.stdout.write('\n')
    if (verbose) {
      logVerbose('end of ffmpeg output.')
    }
  })
} else {
  if (verbose) {
    let cmd = 'ffmpeg'
    for (let arg of args) {
      let str = JSON.stringify(arg)
      if (str == `"${arg}"`) {
        cmd += ' ' + arg
      } else {
        cmd += ' ' + str
      }
    }
    console.log('> ' + cmd)
    logVerbose('starting ffmpeg process...')
  }
  let childProcess = spawn('ffmpeg', args, {
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  attachChildProcess({
    childProcess,
    onStderr: checkOverwrite,
    onProgress,
  })
    .then(() => {
      process.stdout.write('\n')
      if (verbose) {
        logVerbose('ffmpeg process finished.')
      }
    })
    .catch(error => {
      if (verbose) {
        logVerbose('ffmpeg process failed.')
      }
      process.stderr.write('\n')
      for (let line of errorLines) {
        console.error(line)
      }
      console.error('ffmpeg process error:', error)
      process.exit(1)
    })
}
