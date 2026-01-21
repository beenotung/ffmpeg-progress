import { spawn } from 'child_process'
import {
  attachChildProcess,
  attachStream,
  OnProgressArgs,
  secondsToString,
} from './core'

let args = process.argv.slice(2)

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

OPTIONS:
  -h, --help     show this help message and exit
  --version      show version and exit

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
}

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

if (args.length == 0) {
  console.log('reading ffmpeg output from pipe...')
  attachStream({
    stream: process.stdin,
    onData: checkOverwrite,
    onProgress,
  }).on('end', () => {
    process.stdout.write('\n')
    console.log('end of ffmpeg output.')
  })
} else {
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
      console.log('ffmpeg process finished.')
    })
    .catch(error => {
      process.stderr.write('\n')
      for (let line of errorLines) {
        console.error(line)
      }
      console.error('ffmpeg process error:', error)
      process.exit(1)
    })
}
