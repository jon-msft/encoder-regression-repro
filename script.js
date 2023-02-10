console.log("hello world");

const recordButton = document.querySelector("#record");
const stopButton = document.querySelector("#stop");

const qvgaConstraints = { video: { width: 320, height: 240 } };
const vgaConstraints = { video: { width: 640, height: 480 } };
const hdConstraints = { video: { width: 1280, height: 720 } };
// const fullHdConstraints = {
//   video: { width: { min: 1920 }, height: { min: 1080 } },
// };
// const tv4KConstraints = {
//   video: { width: { exact: 3840 }, height: { exact: 2160 } },
// };
// const cinema4KConstraints = {
//   video: { width: { exact: 4096 }, height: { exact: 2160 } },
// };
// const eightKConstraints = {
//   video: { width: { min: 7680 }, height: { min: 4320 } },
// };

let constraints = hdConstraints; // TODO additional constraints to add to repro?

const videoCodec = "avc1.4D002A"; // main profile, level 4.2
videoBps = 4000000; // TODO check this

const webmCodecId = "MPEG4/ISO/AVC"; // 'V_MPEG4/ISO/AVC';

const videoSelect = document.querySelector("select#videoSource");

let recorder;
function record() {
  addToEventLog("record clicked");
  recorder = new MediaRecorder(mediaStream, {
    mimeType: `video/webm; codecs=${videoCodec}`,
    bitsPerSecond: videoBps,
  });
  recorder.addEventListener("dataavailable", onRecordingReady);

  recordButton.disabled = true;
  stopButton.disabled = false;

  recorder.start();
}

async function onRecordingReady(e) {
  let video = document.getElementById("recording");
  // e.data contains a blob representing the recording
  video.src = URL.createObjectURL(e.data);
  video.play();

  const videoFrames = await demux(e.data);
  const reEncodedFrames = await reEncode(videoFrames);
  console.log(reEncodedFrames);
  // TODO mux
  // const muxedResult = mux(videoFrames);
}

function stop() {
  addToEventLog("stop clicked");

  recordButton.disabled = false;
  stopButton.disabled = true;

  // Stopping the recorder will eventually trigger the 'dataavailable' event and we can complete the recording process
  recorder.stop();
}

function addToEventLog(text, severity = "info") {
  // let log = document.querySelector('textarea');
  // log.value += 'log-' + severity + ': ' + text + '\n';
  // if (severity == 'fatal') stop();
  console.log(text);
}

async function demux(webmBlob) {
  const data = await webmBlob.arrayBuffer();
  let mkvDemuxer = new mkvdemuxjs.MkvDemux();
  let part = null;
  mkvDemuxer.push(data); // ArrayBuffer
  let videoFrames = [];
  let timestampOffset = 0;
  let lastTimestamp = 0;
  while ((part = mkvDemuxer.demux()) !== null) {
    console.log(part);

    if (part.frames) {
      part.frames.forEach((f) => {
        // Note: timestamp resets to 0 in every new cluster so we need to offset
        let keyFrame = false;
        if (f.timestamp <= lastTimestamp) {
          timestampOffset += lastTimestamp;
          keyFrame = true;
        }
        lastTimestamp = f.timestamp;
        f.timestamp += timestampOffset;
        videoFrames.push({...f, keyFrame});
      }); // { data, track, timestamp }
    }
  }
  console.log(videoFrames);

  return videoFrames;
}

async function mux(frames) {
  // TODO find better way than save file picker
  const fileHandle = await window.showSaveFilePicker({
    startIn: "videos",
    suggestedName: "myVideo.webm",
    types: [
      {
        description: "Video File",
        accept: { "video/webm": [".webm"] },
      },
    ],
  });

  const fileWritableStream = await fileHandle.createWritable();


  const webmWriter = new WebMWriter({
    fileWriter: fileWritableStream,
    codec: webmCodecId,
    width: constraints.video.width,
    height: constraints.video.width,
  });

    // TODO
  // for (const frame of frames) {
  //   webmWriter.addFrame(frames);  // Takes EncodedVideoChunk
  // }


  //const file = await fileHandle.getFile();
}

async function reEncode(frames) {
  // TODO
  // const encoder = createVideoEncoder

  onDecoderOutput = (frame) => {
    console.log(frame);
    // decodedFrames.push(frame); // TODO pass to encoder
    frame.close();
  }
  const decoder = createVideoDecoder(onDecoderOutput);
  for (const frame of frames) {
    const videochunk = new EncodedVideoChunk({
      type: frame.keyFrame ? 'key' : 'delta',
      data: frame.data,
      // duration: undefined,
      timestamp: frame.timestamp * 1000000,
    });
    decoder.decode(videochunk);
  }
  await decoder.flush();
  await decoder.close();
}

function createVideoEncoder(onOutput) {
  // TODO
  // const videoEncoder = new VideoEncoder({
  //   output: onOutput,
  //   error: (error: Error) => onError({ reason: 'Video Encoding Error', error }),
  // });

  // const width =
  //   this.video.processingTasks && this.video.processingTasks.length > 0 ? this.video.processingTasks[0].width : 1280;
  // const height =
  //   this.video.processingTasks && this.video.processingTasks.length > 0 ? this.video.processingTasks[0].height : 720;
  // // Fallback of 1280x720 does not preserve aspect ratio, but it seems like there should always be processingTasks of length 1, so we should never hit that case
  // videoEncoder.configure({
  //   codec: this.video.config.videoCodec,
  //   // displayHeight: height,
  //   // displayWidth: width,
  //   codedHeight: height,
  //   codedWidth: width,
  //   height,
  //   width,
  //   bitrate: this.video.config.videoBitrate ? this.video.config.videoBitrate : undefined,
  //   framerate: 30,
  //   latencyMode: 'quality',
  //   scalabilityMode: 'L1T2',
  //   avc: {
  //     format: 'annexb',
  //   },
  // });

  // // eslint-disable-next-line consistent-return
  // return videoEncoder;
}

function createVideoDecoder(onOutput) {
  const videoDecoder = new VideoDecoder({
    output: onOutput,
    error: console.error,
  });
  videoDecoder.configure({
    codec: videoCodec,
  });

  return videoDecoder;
}

document.addEventListener("DOMContentLoaded", async function (event) {
  addToEventLog("DOM Content Loaded");

  // try {
  //   gotDevices(await navigator.mediaDevices.enumerateDevices());
  // } catch (e) {
  //   addToEventLog("Error in Device enumeration");
  // }
  // constraints.deviceId = videoSource ? { exact: videoSource } : undefined;

  // Get a MediaStream from the webcam.
  mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  // Connect the webcam stream to the video element.
  document.getElementById("inputVideo").srcObject = mediaStream;

  recordButton.onclick = () => {
    record();
  };

  stopButton.disabled = true;
  stopButton.onclick = () => {
    stop();
  };
});
