import { useRef, useState } from 'react'
import './App.css'
import { classNames } from './classNames'

type StreamType = 'video' | 'audio' | 'screen'

type Stream = Record<StreamType, MediaStream | null>

export default function App() {
  const camera = useRef<HTMLVideoElement>(null)
  const screen = useRef<HTMLVideoElement>(null)
  const ws = useRef<FileSystemWritableFileStream | null>(null)

  const [record, setRecord] = useState<MediaRecorder | null>(null)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [screenEnabled, setScreenEnabled] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)

  const stream = useRef<Stream>({
    audio: null,
    screen: null,
    video: null,
  })

  const wrapper = useRef<HTMLDivElement>(null)

  const toggleCamera = () => {
    const current = stream.current.video
    if (current) {
      current.getTracks().forEach((i) => i.stop())
      stream.current.video = null
      setCameraEnabled(false)
    } else {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 720 } })
        .then((video) => {
          stream.current.video = video
          camera.current!.srcObject = video
          setCameraEnabled(true)
        })
    }
  }

  const toggleMic = () => {
    const current = stream.current.audio
    if (current) {
      current.getTracks().forEach((i) => i.stop())
      stream.current.video = null
      setMicEnabled(false)
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((audio) => {
        stream.current.audio = audio
        setMicEnabled(true)
      })
    }
  }

  const toggleScreen = () => {
    const current = stream.current.screen
    if (current) {
      current.getTracks().forEach((i) => i.stop())
      stream.current.screen = null
      setScreenEnabled(false)
    } else {
      navigator.mediaDevices
        .getDisplayMedia({
          video: {
            frameRate: 60,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
        .then((s) => {
          stream.current.screen = s
          screen.current!.srcObject = s
          setScreenEnabled(true)
        })
    }
  }

  const toggleRecord = async () => {
    if (record) {
      record.stop()
      setRecord(null)
    } else {
      if (!wrapper.current) return
      // создаем холст
      const canvas = document.createElement('canvas')
      const width = 1920
      const height = 1080
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const drawFrame = () => {
        // 1. Очищаем весь канвас (удаляем предыдущий кадр)
        ctx!.clearRect(0, 0, width, height)

        // Берём HTMLVideoElement из ref
        const cam = stream.current.video
        const scr = stream.current.screen

        const camVideo = camera.current
        const scrVideo = screen.current

        // 2. Если есть экран, рендерим его на задний план на весь холст
        if (scr && scrVideo) {
          ctx!.drawImage(scrVideo, 0, 0, width, height)
        }

        // 3. Если есть камера, рисуем её маленьким прямоугольником в углу
        if (cam && camVideo) {
          if (scr) {
            const camWidth = width / 4 // 25% ширины
            const camHeight = height / 4 // 25% высоты
            ctx!.drawImage(
              camVideo,
              width - camWidth - 10,
              height - camHeight - 10,
              camWidth,
              camHeight
            )
          } else {
            ctx!.drawImage(camVideo, 0, 0, width, height)
          }
        }

        // 4. Планируем следующее обновление кадра
        requestAnimationFrame(drawFrame)
      }

      drawFrame()

      // Получаем поток
      const canvasStream = canvas.captureStream(30) // 30fps

      const mainStream = new MediaStream()

      canvasStream.getVideoTracks().forEach((t) => mainStream.addTrack(t))

      if (stream.current.audio)
        stream.current.audio
          .getAudioTracks()
          .forEach((i) => mainStream.addTrack(i))

      // Теперь передадим в MediaRecorder
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: 'recording.webm',
        types: [
          { description: 'WebM Video', accept: { 'video/webm': ['.webm'] } },
        ],
      })

      ws.current = await fileHandle.createWritable()

      const r = new MediaRecorder(mainStream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 8_000_000,
      })

      r.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          await ws.current!.write(e.data)
        }
      }

      r.onstop = async () => {
        await ws.current!.close()
      }

      r.start(200)
      setRecord(r)
    }
  }

  return (
    <div className="container">
      <div ref={wrapper} className="videoWrapper">
        <video
          className={classNames('video', {
            enabledVideo: cameraEnabled,
            videoMinimize: screenEnabled,
          })}
          ref={camera}
          autoPlay
          muted
        />
        <video
          className={classNames('screen', { activeScreen: screenEnabled })}
          ref={screen}
          autoPlay
          muted
        />
      </div>
      <div className="control">
        <button
          className={classNames('button', { activeBtn: cameraEnabled })}
          onClick={toggleCamera}>
          toggle camera
        </button>
        <button
          className={classNames('button', { activeBtn: screenEnabled })}
          onClick={toggleScreen}>
          toggle screen
        </button>
        <button
          className={classNames('button', { activeBtn: micEnabled })}
          onClick={toggleMic}>
          toggle mic
        </button>
        <button
          className={classNames('button', { activeBtn: !!record })}
          onClick={toggleRecord}>
          toggle record
        </button>
      </div>
    </div>
  )
}
