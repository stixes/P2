var socket = io("http://localhost:3000");

class Note {
  constructor(name, octave, accidental, velocity, startTime, duration) {
    this.name = name;
    this.octave = octave;
    this.accidental = accidental;
    this.velocity = velocity;
    this.startTime = startTime;
    this.duration = duration;
  }
}

class ScoreInfo {
  constructor(bpm, timeSignatureTop, timeSignatureBottom, numberOfBarsToRecord, countInCount) {
    this.bpm = bpm;
    this.timeSignatureTop = timeSignatureTop;
    this.timeSignatureBottom = timeSignatureBottom;
    this.numberOfBarsToRecord = numberOfBarsToRecord;
    this.countInCount = countInCount;
  }
}

var globalArray;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms)); //stolen
}

//Calls functions to record midi for the length of recordDuration, then convert it to a .mid file
async function generateMidi() {
  var Score = new ScoreInfo(getTextBox("bpm"), getTextBox("timeSignatureTop"), getTextBox("timeSignatureBottom"), getTextBox("numberOfBarsToRecord"), getTextBox("countInCount"));
  playCountIn(Score, Score.timeSignatureBottom*Score.countInCount);
  await sleep(caclulateTimePerQuaterNote(Score.bpm)*Score.timeSignatureBottom*Score.countInCount);
  console.log(Score);
  var inputDevice = 0;
  var outputArray = [];
  var correctedStartTime = performance.now();
  recordMidi(outputArray, inputDevice);
  await sleep(caclulateTimePerQuaterNote(Score.bpm)*Score.timeSignatureTop*Score.numberOfBarsToRecord);
  arrayToTrack(outputArray, correctedStartTime);
  disableWebMidiRecord();
}

//Gets the contents of an HTML input box
function getTextBox(boxID) {
  return document.getElementById(boxID).value;
}

//Plays the desired count in
async function playCountIn(Score, countInNum) {
  var countIn = generateCountIn(countInNum);

  for (var i = 0; i < countInNum; i++) {
    countIn[i].play();
    await sleep(caclulateTimePerQuaterNote(Score.bpm));
  }
}

//Generates the array to used by playCountIn
function generateCountIn(countInNum) {
  var countIn = [];
  for (var i = 0; i < countInNum; i++) {
    countIn[i] = new Audio("audio/countIn.mp3");
  }
  return countIn;
}

//Opens for recording a given MIDI bus
function recordMidi(outputArray, inputDevice) {

  WebMidi
  .enable()
  .then(onEnabled)

  function onEnabled() {

    //Error message if no MIDI devices are found
    if (WebMidi.inputs.length < 1) {
      document.body.innerHTML+= "No device detected.";
    }

    const mySynth = WebMidi.inputs[inputDevice];

    let noteName;
    let noteAccidental;
    let noteOctave;
    let velocity;
    let startTime;
    let duration;
    var noteArray = [];

    mySynth.channels[1].addListener("noteon", e => {
      noteName = e.note.name;
      //The accidental will return "undefined" if there is no accidental, so we need to check for that to avoid an invalid note
      if (e.note.accidental == "#") {
          noteAccidental = e.note.accidental;
      }
      else {
          noteAccidental = "";
      }

      //Saving the values from noteon to the noteArray to keep track of active notes
      noteOctave = e.note.octave;
      velocity = e.rawValue;
      startTime = e.timestamp;
      let newNote = new Note(e.note.name, e.note.octave, e.note.accidental, e.note.attack, e.timestamp);

      noteArray.push(newNote);
    });

    mySynth.channels[1].addListener("noteoff", e => {
      duration = e.timestamp - startTime;

      var noteFound = false;
      var i = 0;

      //Finds the note that matches the noteoff event, and removes it from the active noteArray
      while (i < noteArray.length && !noteFound) {
        if (noteArray[i].name == e.note.name) {
          if (noteArray[i].accidental == undefined) {
            noteArray[i].accidental = "";
          }
          noteArray[i].duration = e.timestamp - noteArray[i].startTime;
          outputArray.push(noteArray[i]);
          noteArray.splice(i, 1);
          noteFound = true;
        }
        i++;
      }
      console.log(outputArray[outputArray.length-1]);
    });
  }
}

function caclulateTimePerQuaterNote(bpm) {
  return 60/bpm*1000;
}

//Converts the outputArray from recordMidi to a .mid file
function arrayToTrack(outputArray, correctedStartTime){

  let track = new MidiWriter.Track();
  track.setTempo(120, 0);

  //Generates each note of the .mid file from the outputArray. Also calculates the correct start time for each note
  for(var i = 0; i < outputArray.length; i++){
    let startTime = outputArray[i].startTime/1000*256-correctedStartTime/1000*256;
    track.addEvent([
      new MidiWriter.NoteEvent({pitch: [outputArray[i].name + outputArray[i].accidental + outputArray[i].octave], duration: "T"+(outputArray[i].duration/1000*256).toFixed(0), startTick: startTime, velocity: outputArray[i].velocity*100})
    ], function(event, index) {
      return {sequential: false};
    }
    );
  }
  let write = new MidiWriter.Writer(track);
  globalArray = write.buildData();
  var trackNumber = getTextBox("trackNumber");
  if (trackNumber < 1 || trackNumber > 16){
    console.error(trackNumber + " is not a valid track number\n");
  }
  globalArray[2] = trackNumber;
  // Remove entry [0] to send less data
  globalArray.shift();
  pairNoteEvents(1);
}

// Pair note events into pairs for a more neat array
function pairNoteEvents(trackNumber) {
  let noteOnArray = [];
  let finishedNoteArray = [];
  for (let i = 1; i < globalArray[0].events.length; i++) {
    if (globalArray[0].events[i].type === "note-on") {
      noteOnArray.push(globalArray[0].events[i]);
    }
    else if (globalArray[0].events[i].type === "note-off") {
      for (let j = 0; j < noteOnArray.length; j++) {
        if (noteOnArray[j].pitch === globalArray[0].events[i].pitch) {
          note = new Note;
          note.name = noteOnArray[j].pitch;
          note.velocity = noteOnArray[j].velocity;
          note.startTime = noteOnArray[j].startTick;
          note.duration = globalArray[0].events[i].duration;
          finishedNoteArray.push(note);
          noteOnArray.splice(j, 1);
        }
      }
    }
  }
  finishedNoteArray.unshift(trackNumber);
  console.log(finishedNoteArray);
  socket.emit("Send array", finishedNoteArray);
}

//Disables the MIDI recording
function disableWebMidiRecord() {
  WebMidi.disable();
}
