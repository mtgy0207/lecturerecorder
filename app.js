const recordButton = document.querySelector("#recordButton");
const stopButton = document.querySelector("#stopButton");
const makeNotesButton = document.querySelector("#makeNotesButton");
const exportButton = document.querySelector("#exportButton");
const clearTranscriptButton = document.querySelector("#clearTranscriptButton");
const copyNotesButton = document.querySelector("#copyNotesButton");
const recordLabel = document.querySelector("#recordLabel");
const statusLabel = document.querySelector("#status");
const transcriptArea = document.querySelector("#transcript");
const notesEl = document.querySelector("#notes");
const speechHint = document.querySelector("#speechHint");
const lectureTitle = document.querySelector("#lectureTitle");
const lectureDate = document.querySelector("#lectureDate");
const printTitle = document.querySelector("#printTitle");
const printDate = document.querySelector("#printDate");
const printNotes = document.querySelector("#printNotes");
const audioCard = document.querySelector("#audioCard");
const audioPlayback = document.querySelector("#audioPlayback");
const downloadAudio = document.querySelector("#downloadAudio");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recorder = null;
let mediaStream = null;
let audioChunks = [];
let finalTranscript = "";
let isRecording = false;

lectureDate.valueAsDate = new Date();

if (!SpeechRecognition) {
  speechHint.textContent = "This browser can record audio, but live transcription is not available. Try Chrome or Edge, or paste a transcript.";
}

function setStatus(text, recording = false) {
  statusLabel.textContent = text;
  statusLabel.classList.toggle("recording", recording);
}

function sentenceCase(text) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|(?:\s+-\s+)/)
    .map(sentenceCase)
    .filter((sentence) => sentence.length > 8);
}

function getKeywords(text) {
  const stopWords = new Set([
    "about", "after", "again", "also", "because", "before", "being", "between", "could", "during",
    "each", "from", "have", "into", "just", "lecture", "like", "more", "most", "other", "should",
    "some", "than", "that", "their", "there", "these", "they", "this", "through", "today", "under",
    "very", "were", "what", "when", "where", "which", "while", "with", "would", "your"
  ]);

  const counts = new Map();
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !stopWords.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([word]) => word);
}

function buildNotes(transcript) {
  const sentences = splitSentences(transcript);
  const important = sentences.filter((sentence) =>
    /\b(important|remember|key|therefore|because|means|defined|example|result|summary|first|second|third|finally)\b/i.test(sentence)
  );
  const keyPoints = [...important, ...sentences].slice(0, 8);
  const keywords = getKeywords(transcript);
  const actionItems = sentences.filter((sentence) =>
    /\b(read|review|practice|complete|submit|prepare|assignment|homework|exam|quiz|deadline)\b/i.test(sentence)
  ).slice(0, 5);

  const keyList = keyPoints.length
    ? keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("")
    : "<li>Add more transcript text, then make notes again.</li>";

  const keywordList = keywords.length
    ? keywords.map((word) => `<li>${escapeHtml(word)}</li>`).join("")
    : "<li>No repeated terms found yet.</li>";

  const actionList = actionItems.length
    ? actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>No tasks or deadlines detected.</li>";

  return `
    <h3>Key Points</h3>
    <ul>${keyList}</ul>
    <h3>Important Terms</h3>
    <ul>${keywordList}</ul>
    <h3>Tasks, Deadlines, or Follow-up</h3>
    <ul>${actionList}</ul>
    <h3>Short Summary</h3>
    <p>${escapeHtml(sentences.slice(0, 3).join(" ")) || "Summary will appear after transcription."}</p>
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupRecognition() {
  if (!SpeechRecognition) return null;

  const speech = new SpeechRecognition();
  speech.continuous = true;
  speech.interimResults = true;
  speech.lang = navigator.language || "en-US";

  speech.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += `${text.trim()} `;
      } else {
        interim += text;
      }
    }
    transcriptArea.value = `${finalTranscript}${interim}`.trim();
  };

  speech.onerror = () => {
    speechHint.textContent = "Live transcription paused. The audio recording can still continue.";
  };

  speech.onend = () => {
    if (isRecording) {
      try {
        speech.start();
      } catch {
        speechHint.textContent = "Live transcription stopped. Recording is still active.";
      }
    }
  };

  return speech;
}

async function startRecording() {
  if (isRecording) return;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(mediaStream);
    audioChunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const audioUrl = URL.createObjectURL(audioBlob);
      audioPlayback.src = audioUrl;
      downloadAudio.href = audioUrl;
      audioCard.hidden = false;
    };

    recorder.start();
    recognition = setupRecognition();
    if (recognition) recognition.start();

    isRecording = true;
    recordButton.disabled = true;
    stopButton.disabled = false;
    recordLabel.textContent = "Recording";
    setStatus("Recording", true);
  } catch {
    setStatus("Microphone blocked");
    speechHint.textContent = "Allow microphone access in your browser, then try again.";
  }
}

function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  recordButton.disabled = false;
  stopButton.disabled = true;
  recordLabel.textContent = "Start Recording";
  setStatus("Stopped");

  if (recognition) {
    recognition.onend = null;
    recognition.stop();
  }

  if (recorder && recorder.state !== "inactive") recorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
}

function makeNotes() {
  const transcript = transcriptArea.value.trim();
  notesEl.innerHTML = buildNotes(transcript);
  setStatus(transcript ? "Notes updated" : "Add transcript first");
}

function exportPdf() {
  printTitle.textContent = lectureTitle.value.trim() || "Untitled Lecture";
  printDate.textContent = lectureDate.value
    ? new Date(`${lectureDate.value}T00:00:00`).toLocaleDateString()
    : "";
  printNotes.innerHTML = notesEl.innerHTML;
  window.print();
}

recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
makeNotesButton.addEventListener("click", makeNotes);
exportButton.addEventListener("click", exportPdf);

clearTranscriptButton.addEventListener("click", () => {
  transcriptArea.value = "";
  finalTranscript = "";
  setStatus("Transcript cleared");
});

copyNotesButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(notesEl.innerText);
  setStatus("Notes copied");
});
