# ffmpeg-progress

Extract progress from ffmpeg child_process output stream

[![npm Package Version](https://img.shields.io/npm/v/ffmpeg-progress)](https://www.npmjs.com/package/ffmpeg-progress)

## Installation

```bash
npm install ffmpeg-progress
```

## Usage Example

**Get video duration**:

```typescript
import { scanVideo } from 'ffmpeg-progress'

console.log(await scanVideo('test/in.mp4'))
// { duration: '00:52:04.78', seconds: 3124.78 }
```

**Convert video and monitor progress**:

```typescript
import { startTimer } from '@beenotung/tslib/timer'
import { convertFile, parseToSeconds } from 'ffmpeg-progress'

let timer = startTimer('estimate duration')
await convertFile({
  inFile: 'test/in.mp4',
  outFile: 'test/out.mp4',
  onDuration(duration) {
    timer.next('convert video')
    timer.setEstimateProgress(parseToSeconds(duration))
  },
  onProgress(args) {
    timer.tick(args.deltaSeconds)
  },
})
timer.end()
```

## Typescript Types

```typescript
import { ChildProcessWithoutNullStreams } from 'child_process'

export function parseToSeconds(str: string): number

export function scanVideo(file: string): Promise<ScanVideoResult>

export type ScanVideoResult = {
  duration: string
  seconds: number
}

export type ProgressArgs = {
  onData?: (chunk: Buffer) => void
  onDuration?: (duration: string) => void
  onTime?: (time: string) => void
  onProgress?: (args: {
    deltaSeconds: number
    currentSeconds: number
    totalSeconds: number
    time: string
    duration: string
  }) => void
}

export function convertFile(
  args: {
    inFile: string
    outFile: string
  } & ProgressArgs,
): Promise<void>

export function attachChildProcess(
  args: {
    childProcess: ChildProcessWithoutNullStreams
  } & ProgressArgs,
): Promise<void>
```

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
