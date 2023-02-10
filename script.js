// TODO some funny clever and informative intro text

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
  const muxedResult = await mux(reEncodedFrames);
  console.log(muxedResult);
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

  for (const frame of frames) {
    webmWriter.addFrame(frame);  // Takes EncodedVideoChunk
  }

  await webmWriter.complete();
  fileWritableStream.close();
  const file = await fileHandle.getFile();
  return file;
}

async function reEncode(frames) {
  let encodedChunks = [];
  onEncoderOutput = (chunk) => {
    encodedChunks.push(chunk);
  }
  const encoder = createVideoEncoder(onEncoderOutput);

  onDecoderOutput = (frame) => {
    console.log(frame);
    encoder.encode(frame); // TODO handle keyframes videoEncoder.encode(frame, { keyFrame: true });
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

  return encodedChunks;
}

function createVideoEncoder(onOutput) {
  const videoEncoder = new VideoEncoder({
    output: onOutput,
    error: console.error
  });

  videoEncoder.configure({
    codec: videoCodec,
    // displayHeight: height,
    // displayWidth: width,
    // codedHeight: constraints.height,
    // codedWidth: constraints.width,
    height: constraints.video.height,
    width: constraints.video.width,
    // height,
    // width,
    bitrate: videoBps,
    framerate: 30, // TODO remove?
    latencyMode: 'quality',
    // scalabilityMode: 'L1T3', // TODO play with this?
    avc: {
      format: 'annexb',
    },
  });

  return videoEncoder;
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
