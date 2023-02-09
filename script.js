console.log("hello world");

const recordButton = document.querySelector('#record');
const stopButton = document.querySelector('#stop');

const qvgaConstraints   = {video: {width: 320,  height: 240}};
const vgaConstraints    = {video: {width: 640,  height: 480}};
const hdConstraints     = {video: {width: 1280, height: 720}};
const fullHdConstraints = {video: {width: {min: 1920}, height: {min: 1080}}};
const tv4KConstraints   = {video: {width: {exact: 3840}, height: {exact: 2160}}};
const cinema4KConstraints = {video: {width: {exact: 4096}, height: {exact: 2160}}};
const eightKConstraints = {video: {width: {min: 7680}, height: {min: 4320}}};

let constraints = hdConstraints; // TODO additional constraints to add to repro?

const codec = "avc1.4D002A"; // main profile, level 4.2

const videoSelect = document.querySelector('select#videoSource');

let recorder;
function record() {
  addToEventLog('record clicked');
  recorder = new MediaRecorder(mediaStream); // TODO codec options
  recorder.addEventListener('dataavailable', onRecordingReady);

  recordButton.disabled = true;
  stopButton.disabled = false;

  recorder.start();
}

function onRecordingReady(e) {
  let video = document.getElementById('recording');
  // e.data contains a blob representing the recording
  video.src = URL.createObjectURL(e.data);
  video.play();

  // TODO demux, re-encode, and re-mux the vide
  demux(e.data);
}

function stop() {
  addToEventLog('stop clicked');

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
  while ((part = mkvDemuxer.demux()) !== null) {
      // Do something with part
      console.log(part);
  }
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
  }

  stopButton.disabled = true;
  stopButton.onclick = () => {
    stop();
  }
});
