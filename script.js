const video = document.getElementById('video')
const socket = new WebSocket('ws://localhost:9001');

socket.onopen = () => console.log('Conectado al servidor WebSocket');
socket.onerror = error => console.error('WebSocket error:', error);

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(startVideo)

function startVideo() {
  navigator.getUserMedia(
    { video: {} },
    stream => video.srcObject = stream,
    err => console.error(err)
  )
}

video.addEventListener('play', () => {
  const canvas = faceapi.createCanvasFromMedia(video)
  document.body.append(canvas)
  const displaySize = { width: video.width, height: video.height }
  faceapi.matchDimensions(canvas, displaySize)

  let emotionsCount = {}

  // Función para enviar emoción predominante y resetear contador
  function sendAndReset() {
    if (Object.keys(emotionsCount).length === 0) {
      console.log("No se detectaron emociones en este intervalo")
    } else {
      let dominantEmotion = Object.keys(emotionsCount).reduce((a, b) => emotionsCount[a] > emotionsCount[b] ? a : b)
      console.log("Emoción predominante en 30s:", dominantEmotion)
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(dominantEmotion)
      }
    }
    emotionsCount = {}  // Reset contador para siguiente intervalo
  }

  // Detectar emociones cada 500ms y acumular conteo
  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions()
    const resized = faceapi.resizeResults(detections, displaySize)
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawDetections(canvas, resized)
    faceapi.draw.drawFaceExpressions(canvas, resized)

    if (resized.length > 0) {
      const expressions = resized[0].expressions
      const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1])
      const dominantEmotionNow = sorted[0][0]

      if (!emotionsCount[dominantEmotionNow]) emotionsCount[dominantEmotionNow] = 0
      emotionsCount[dominantEmotionNow]++
    }
  }, 500)

  // Cada 30 segundos enviar emoción predominante y reiniciar conteo
  setInterval(sendAndReset, 10000)
})
