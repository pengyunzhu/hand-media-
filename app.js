const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const statusEl = document.getElementById('status');
const toggleBtn = document.getElementById('toggleFacing');
const startBtn = document.getElementById('startCamera');

let useFront = false;
let camera = null;
let player = null;
let youtubeReady = false;
const youtubeVideoId = 'dQw4w9WgXcQ';
let lastGesture = null;
let lastActionTime = 0;
const COOLDOWN = 2000; // ms

function setStatus(text){
  statusEl.textContent = '狀態：' + text;
}

function distance(a, b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function isFingerFolded(tip, pip){
  // folded: tip is closer to wrist direction than pip (in normalized coords y increases downward)
  return tip.y > pip.y; // simple heuristic: tip below pip => folded
}

function detectGesture(landmarks){
  if(!landmarks || landmarks.length === 0) return null;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  const middleTip = landmarks[12];
  const middlePip = landmarks[10];
  const ringTip = landmarks[16];
  const ringPip = landmarks[14];
  const pinkyTip = landmarks[20];
  const pinkyPip = landmarks[18];
  const indexMcp = landmarks[5];

  // approximate hand size for thresholds
  const handSize = distance(landmarks[0], landmarks[9]) || 0.2;

  // OK gesture: thumb tip close to index tip, other fingers mostly extended
  const thumbIndexDist = distance(thumbTip, indexTip);
  const othersExtended = (middleTip.y < middlePip.y) && (ringTip.y < ringPip.y) && (pinkyTip.y < pinkyPip.y);
  if(thumbIndexDist < handSize * 0.18 && othersExtended){
    return 'OK';
  }

  // Open palm: all fingers extended
  const allExtended = (indexTip.y < indexPip.y) && (middleTip.y < middlePip.y) && (ringTip.y < ringPip.y) && (pinkyTip.y < pinkyPip.y);
  if(allExtended){
    return 'PALM_OPEN';
  }

  // Thumbs up: thumb extended upward and other fingers folded
  const fingersFolded = isFingerFolded(indexTip, indexPip) && isFingerFolded(middleTip, middlePip) && isFingerFolded(ringTip, ringPip) && isFingerFolded(pinkyTip, pinkyPip);
  const thumbHigher = thumbTip.y < indexMcp.y; // smaller y = higher on screen
  if(fingersFolded && thumbHigher){
    return 'THUMBS_UP';
  }

  return null;
}

function handleGesture(gesture){
  const now = Date.now();
  if(!gesture) return;
  if(gesture === lastGesture && (now - lastActionTime) < COOLDOWN) return;
  lastGesture = gesture;
  lastActionTime = now;

  if(gesture === 'OK'){
    playYoutubeMusic();
  }else if(gesture === 'THUMBS_UP'){
    setStatus('辨識：讚，你看起來喜歡這首歌');
    speak('看起來你喜歡這首歌');
  }else if(gesture === 'PALM_OPEN'){
    setStatus('辨識：手掌攤開，暫停 YouTube 音樂');
    speak('暫停播放');
    pauseYoutubeMusic();
  }
}

function speak(text){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function onYouTubeIframeAPIReady(){
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    videoId: youtubeVideoId,
    playerVars: {
      autoplay: 0,
      controls: 0,
      rel: 0,
      modestbranding: 1
    },
    events: {
      onReady: () => { youtubeReady = true; },
      onStateChange: (event) => {
        if(event.data === YT.PlayerState.ENDED){
          setStatus('YouTube 音樂播放結束');
        }
      }
    }
  });
}

function playYoutubeMusic(){
  if(!youtubeReady || !player){
    setStatus('YouTube 撥放器載入中...');
    return;
  }
  setStatus('辨識：OK，開始播放 YouTube 音樂');
  speak('開始播放音樂');
  player.playVideo();
}

function pauseYoutubeMusic(){
  if(player && youtubeReady){
    player.pauseVideo();
  }
}

function onResults(results){
  // resize canvas to match source image
  if(results.image){
    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;
    canvasCtx.save();
    canvasCtx.clearRect(0,0,canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if(results.multiHandLandmarks && results.multiHandLandmarks.length > 0){
      for(const landmarks of results.multiHandLandmarks){
        window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS, {color:'#00FF00', lineWidth:4});
        window.drawLandmarks(canvasCtx, landmarks, {color:'#FF0000', lineWidth:2});

        const gesture = detectGesture(landmarks);
        if(gesture){
          handleGesture(gesture);
        }
      }
    } else {
      setStatus('等待偵測...');
    }

    canvasCtx.restore();
  }
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

function startCamera(){
  if(camera){
    camera.stop();
    camera = null;
  }
  setStatus('相機初始化中...');
  const facingMode = useFront ? 'user' : 'environment';
  camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280,
    height: 720,
    facingMode
  });
  camera.start().catch(err => {
    console.error('camera start failed', err);
    setStatus('相機啟動失敗，請檢查權限或重新整理頁面');
  });
}

toggleBtn.addEventListener('click', () => {
  useFront = !useFront;
  setStatus(useFront ? '使用前鏡頭' : '使用後鏡頭');
  startCamera();
});

startBtn.addEventListener('click', () => {
  startCamera();
});

setStatus('點擊「啟動相機」以開始偵測');
