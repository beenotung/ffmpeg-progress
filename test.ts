import { startTimer } from '@beenotung/tslib/timer'
import { convertFile, parseTime, scanVideo } from './core'

async function main() {
  console.log('video:', await scanVideo('test/in.mp4'))
  let timer = startTimer('estimate duration')
  await convertFile({
    inFile: 'test/in.mp4',
    outFile: 'test/out.mp4',
    onDuration(duration) {
      timer.next('convert video')
      timer.setEstimateProgress(parseTime(duration))
    },
    onProgress(args) {
      timer.tick(args.deltaSeconds)
    },
  })
  timer.end()
}
main().catch(e => console.error(e))
