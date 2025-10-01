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

  // Для микширования аудио
  const audioContextRef = useRef<AudioContext | null>(null)
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const silentSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

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
    if (micEnabled) {
      stream.current.audio?.getTracks().forEach((t) => t.stop())
      if (micSourceRef.current) micSourceRef.current.disconnect()
      stream.current.audio = null
      setMicEnabled(false)
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((audio) => {
        stream.current.audio = audio
        setMicEnabled(true)
        if (audioContextRef.current && destinationRef.current) {
          micSourceRef.current =
            audioContextRef.current.createMediaStreamSource(audio)
          micSourceRef.current.connect(destinationRef.current)
        }
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
        ctx.clearRect(0, 0, width, height)

        const cam = stream.current.video
        const scr = stream.current.screen

        const camVideo = camera.current
        const scrVideo = screen.current

        if (scr && scrVideo) {
          ctx.drawImage(scrVideo, 0, 0, width, height)
        }

        if (cam && camVideo) {
          if (scr) {
            const camWidth = width / 4
            const camHeight = height / 4
            ctx.drawImage(
              camVideo,
              width - camWidth - 10,
              height - camHeight - 10,
              camWidth,
              camHeight
            )
          } else {
            ctx.drawImage(camVideo, 0, 0, width, height)
          }
        }

        requestAnimationFrame(drawFrame)
      }

      drawFrame()

      // получаем поток с canvas
      const canvasStream = canvas.captureStream(30)
      const mainStream = new MediaStream()
      canvasStream.getVideoTracks().forEach((t) => mainStream.addTrack(t))

      // Создаем AudioContext и silent track, если еще не создано
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
        destinationRef.current =
          audioContextRef.current.createMediaStreamDestination()

        // silent track
        const oscillator = audioContextRef.current.createOscillator()
        oscillator.type = 'square'
        oscillator.frequency.value = 0
        oscillator.start()
        silentSourceRef.current = oscillator.connect(
          destinationRef.current
        ) as MediaStreamAudioSourceNode
      }

      // подключаем микрофон, если включен
      if (
        stream.current.audio &&
        audioContextRef.current &&
        destinationRef.current
      ) {
        micSourceRef.current = audioContextRef.current.createMediaStreamSource(
          stream.current.audio
        )
        micSourceRef.current.connect(destinationRef.current)
      }

      // Добавляем аудио дорожку в mainStream
      destinationRef.current?.stream
        .getAudioTracks()
        .forEach((t) => mainStream.addTrack(t))

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
