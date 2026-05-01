// Web Speech API wrappers.
//
// Input  → SpeechRecognition (Chrome/Edge): one-shot listen, returns transcript.
// Output → speechSynthesis: queued so announcements don't overlap.

const SR =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export function isRecognitionSupported() {
  return !!SR;
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

export function startRecognition({ lang = "en-US" } = {}) {
  if (!SR) {
    return Promise.reject(
      new Error(
        "SpeechRecognition not supported. Use Chrome/Edge over HTTPS."
      )
    );
  }
  return new Promise((resolve, reject) => {
    const recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let settled = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        settled = true;
        resolve(transcript);
      }
    };
    recognition.onerror = (event) => {
      if (settled) return;
      settled = true;
      reject(new Error(event.error || "Recognition error"));
    };
    recognition.onend = () => {
      if (settled) return;
      settled = true;
      reject(new Error("No speech detected"));
    };

    try {
      recognition.start();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Text-to-speech queue ───────────────────────────────────────────────────

const queue = [];
let speaking = false;

export function speak(text, { lang = "en-US", rate = 1.0, priority = false } = {}) {
  if (!isSpeechSynthesisSupported() || !text) return;
  const item = { text, lang, rate };
  if (priority) {
    cancelSpeech();
    queue.unshift(item);
  } else {
    queue.push(item);
  }
  drain();
}

function drain() {
  if (speaking) return;
  const item = queue.shift();
  if (!item) return;
  speaking = true;
  const utterance = new SpeechSynthesisUtterance(item.text);
  utterance.lang = item.lang;
  utterance.rate = item.rate;
  utterance.onend = () => {
    speaking = false;
    drain();
  };
  utterance.onerror = () => {
    speaking = false;
    drain();
  };
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
  queue.length = 0;
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
  speaking = false;
}

export function langCode(language) {
  // Maps the in-app setting to a BCP-47 tag.
  if (language === "Spanish" || language === "Español") return "es-MX";
  return "en-US";
}
