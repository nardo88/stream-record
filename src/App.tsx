import { useRef, useState } from 'react'
import './App.css'
import { classNames } from './classNames'

type StreamType = 'video' | 'audio' | 'screen'

type Stream = Record<StreamType, MediaStream | null>

export default function App() {
  const camera = useRef<HTMLVideoElement>(null)
  const screen = useRef<HTMLVideoElement>(null)
  const ws = useRef<FileSystemWritableFileStream | null>(null)
  const record = useRef<MediaRecorder | null>(null)
  const [stream, setStream] = useState<Stream>({
    audio: null,
    screen: null,
    video: null,
  })

  const toggleCamera = () => {
    const current = stream.video
    if (current) {
      current.getTracks().forEach((i) => i.stop())
      setStream((p) => ({ ...p, video: null }))
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 720 } })
        .then((video) => {
          setStream((p) => ({ ...p, video }))
          camera.current!.srcObject = video
        })
    }
  }

  const toggleScreen = () => {
    const current = stream.screen
    if (current) {
      current.getTracks().forEach((i) => i.stop())
      setStream((p) => ({ ...p, screen: null }))
    } else {
      navigator.mediaDevices
        .getDisplayMedia({ video: { width: 720 } })
        .then((s) => {
          setStream((p) => ({ ...p, screen: s }))
          screen.current!.srcObject = s
        })
    }
  }

  return (
    <div className="container">
      <div className="videoWrapper">
        <video
          className={classNames('video', {
            enabledVideo: !!stream.video,
            videoMinimize: !!stream.screen,
          })}
          ref={camera}
          autoPlay
          muted
        />
        <video
          className={classNames('screen', { activeScreen: !!stream.screen })}
          ref={screen}
          autoPlay
          muted
        />
      </div>
      <div className="control">
        <button
          className={classNames('button', { activeBtn: !!stream.video })}
          onClick={toggleCamera}>
          toggle camera
        </button>
        <button
          className={classNames('button', { activeBtn: !!stream.screen })}
          onClick={toggleScreen}>
          toggle screen
        </button>
      </div>
    </div>
  )
}
