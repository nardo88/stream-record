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
  const [stream, setStream] = useState<Stream>({
    audio: null,
    screen: null,
    video: null,
  })

  const wrapper = useRef<HTMLDivElement>(null)

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

  const toggleRecord = async () => {
    if (record) {
      record.stop()
      setRecord(null)
    } else {
      if (!wrapper.current) return
      // создаем холст
      const { width, height } = wrapper.current.getBoundingClientRect()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      const drawFrame = () => {
        // 1. Очищаем весь канвас (удаляем предыдущий кадр)
        ctx!.clearRect(0, 0, width, height)

        // Берём HTMLVideoElement из ref
        const cam = stream.video
        const scr = stream.screen

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

      // Теперь передадим в MediaRecorder
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: 'recording.webm',
        types: [
          { description: 'WebM Video', accept: { 'video/webm': ['.webm'] } },
        ],
      })

      ws.current = await fileHandle.createWritable()

      const r = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm',
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
        <button
          className={classNames('button', { activeBtn: !!record })}
          onClick={toggleRecord}>
          toggle record
        </button>
      </div>
    </div>
  )
}
