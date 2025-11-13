import { startTimer } from '@beenotung/tslib/timer'
import {
  convertFile,
  estimateOutSize,
  OnProgressArgs,
  parseToSeconds,
  rotateVideo,
  scanVideo,
} from './core'
import { statSync } from 'fs'

async function test_convert() {
  let inFile = 'test/in.mp4'
  let outFile = 'test/out.mp4'
  console.log('video:', await scanVideo(inFile))
  let timer = startTimer('estimate duration')
  let inSize = statSync(inFile).size
  function checkSize(args: OnProgressArgs) {
    if (!args.totalSeconds) return
    let progress = args.currentSeconds / args.totalSeconds
    let currentOutSize = statSync(outFile).size
    let estimatedOutSize = estimateOutSize({
      inSize,
      currentOutSize,
      currentSeconds: args.currentSeconds,
      totalSeconds: args.totalSeconds,
    })
    console.log()
    console.log({ progress, inSize, currentOutSize, estimatedOutSize })

    if (
      currentOutSize > inSize ||
      (progress >= 0.1 && estimatedOutSize > inSize)
    ) {
      args.abort()
    }
  }
  await convertFile({
    inFile,
    outFile,
    onDuration(duration) {
      timer.next('convert video')
      timer.setEstimateProgress(parseToSeconds(duration))
    },
    onProgress(args) {
      timer.tick(args.deltaSeconds)
      checkSize(args)
    },
  })
  timer.end()
}

async function test_rotation() {
  let inFile = 'test/in.mp4'
  let outFile = 'test/rotate.mp4'
  let timer = startTimer('rotate video')
  await rotateVideo({
    inFile,
    outFile,
    angle: 90,
    onDuration(duration) {
      timer.next('rotate video')
      timer.setEstimateProgress(parseToSeconds(duration))
    },
    onProgress(args) {
      timer.tick(args.deltaSeconds)
    },
  })
  timer.end()
}

test_rotation().catch(e => console.error(e))
