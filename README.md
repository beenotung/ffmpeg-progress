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

**Get video resolution**:

```typescript
import { getVideoResolution } from 'ffmpeg-progress'

console.log(await getVideoResolution('test/rotate.mp4'))
// { width: 3024, height: 4032 }
```

**Get video duration in seconds**:

```typescript
import { getVideoDuration } from 'ffmpeg-progress'

console.log(await getVideoDuration('test/in.mp4'))
// 15.04 (duration in seconds)
```

## Typescript Types

```typescript
import { ChildProcessWithoutNullStreams } from 'child_process'

export function parseToSeconds(str: string): number

export function scanVideo(file: string): Promise<ScanVideoResult>

export type ScanVideoResult = {
  /** @description e.g. "00:03:00.03" */
  duration: string
  /** @description e.g. 180.03 */
  seconds: number
  /** @description e.g. "4032x3024" */
  resolution: string
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

/**
 * take a image frame from the video,
 * this is more accurate than parsing the resolution string in ffmpeg,
 * because the video has rotation metadata.
 */
export function getVideoResolution(video_file: string): Promise<{
  width: number
  height: number
}>

/** @description get video duration in seconds, e.g. `15.04` */
export async function getVideoDuration(video_file: string): Promise<number>
```

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
