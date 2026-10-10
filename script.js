"use strict";

/* =========================================
   JARVIS NEXT — FRONTEND
   ========================================= */

// Paste your deployed Google Apps Script Web App URL here.
// Keep the URL private; do not share it publicly.
const API_URL = "PASTE_YOUR_WEB_APP_URL_HERE";

const STORAGE_KEYS = {
  sessions: "jarvis_next_sessions_v1",
  memory: "jarvis_next_memory_v1",
  active: "jarvis_next_active_session_v1"
};

const $ = (id) => document.getElementById(id);

const ui = {
  sidebar: $("sidebar"),
  closeSidebar: $("closeSidebar"),
  menuButton: $("menuButton"),
  sidebarBackdrop: $("sidebarBackdrop"),
  newChatButton: $("newChatButton"),

  connectionStatus: $("connectionStatus"),
  jarvisCore: $("jarvisCore"),
  coreStatus: $("coreStatus"),
  coreSubtitle: $("coreSubtitle"),

  aiStatus: $("aiStatus"),
  networkStatus: $("networkStatus"),
  voiceStatus: $("voiceStatus"),
  memoryStatus: $("memoryStatus"),

  chatForm: $("chatForm"),
  chatMessages: $("chatMessages"),
  clearChatButton: $("clearChatButton"),
  messageInput: $("messageInput"),
  imageButton: $("imageButton"),
  imageInput: $("imageInput"),
  micButton: $("micButton"),
  sendButton: $("sendButton"),

  assistantPage: $("assistantPage"),
  memoryPage: $("memoryPage"),
  historyPage: $("historyPage"),
  settingsPage: $("settingsPage"),

  memoryList: $("memoryList"),
  historyList: $("historyList")
};

function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn("Could not read local storage:", key);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Could not save local storage:", error);
  }
}

let sessions = loadJSON(STORAGE_KEYS.sessions, []);
let memory = loadJSON(STORAGE_KEYS.memory, []);
let activeSessionId = localStorage.getItem(STORAGE_KEYS.active);
let selectedImage = null;
let recognition = null;
let isSending = false;

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function getActiveSession() {
  return sessions.find((session) => session.id === activeSessionId);
}

function persistSessions() {
  saveJSON(STORAGE_KEYS.sessions, sessions);
  localStorage.setItem(STORAGE_KEYS.active, activeSessionId || "");
}

function setStatus(status, message) {
  if (ui.connectionStatus) {
    ui.connectionStatus.textContent = message;
  }

  if (ui.coreStatus) {
    ui.coreStatus.textContent = status;
  }

  if (ui.aiStatus) {
    ui.aiStatus.textContent = message;
  }
}

function createSession() {
  const session = {
    id: makeId(),
    title: "New conversation",
    createdAt: new Date().toISOString(),
    messages: []
  };

  sessions.unshift(session);
  activeSessionId = session.id;
  persistSessions();
  renderSession(session);
  renderHistory();
  setStatus("STANDBY", "READY");
  return session;
}

function addMessage(role, text, options = {}) {
  const session = getActiveSession();
  if (!session || !ui.chatMessages) return null;

  const message = {
    id: makeId(),
    role,
    text: String(text || ""),
    createdAt: new Date().toISOString()
  };

  const bubble = document.createElement("div");
  bubble.className = "message " + role;
  bubble.dataset.messageId = message.id;

  const label = document.createElement("div");
  label.className = "message-role";
  label.textContent = role === "user" ? "YOU" : "JARVIS";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = message.text;

  bubble.append(label, content);
  ui.chatMessages.appendChild(bubble);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;

  if (!options.temporary) {
    session.messages.push(message);

    if (session.messages.filter((item) => item.role === "user").length === 1) {
      session.title = message.text.slice(0, 36) || "New conversation";
    }

    persistSessions();
    saveMemoryEntry(message);
    renderHistory();
    renderMemory();
  }

  return { message, bubble, content };
}

function updateMessage(entry, text) {
  if (!entry) return;
  entry.content.textContent = String(text || "");
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

function renderSession(session) {
  if (!ui.chatMessages) return;

  ui.chatMessages.replaceChildren();

  if (!session || !session.messages.length) {
    const welcome = document.createElement("div");
    welcome.className = "message assistant";

    const label = document.createElement("div");
    label.className = "message-role";
    label.textContent = "JARVIS";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent =
      "Systems ready, Boss. Send a message to begin.";

    welcome.append(label, content);
    ui.chatMessages.appendChild(welcome);
    return;
  }

  session.messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = "message " + message.role;

    const label = document.createElement("div");
    label.className = "message-role";
    label.textContent = message.role === "user" ? "YOU" : "JARVIS";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = message.text;

    bubble.append(label, content);
    ui.chatMessages.appendChild(bubble);
  });

  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

function saveMemoryEntry(message) {
  memory.unshift({
    id: message.id,
    role: message.role,
    text: message.text,
    createdAt: message.createdAt
  });

  // Keep browser storage within reasonable limits.
  memory = memory.slice(0, 200);
  saveJSON(STORAGE_KEYS.memory, memory);
}

function renderMemory() {
  if (!ui.memoryList) return;

  ui.memoryList.replaceChildren();

  if (!memory.length) {
    ui.memoryList.textContent = "No saved conversation memory yet.";
  } else {
    memory.forEach((item) => {
      const card = document.createElement("div");
      card.className = "memory-item";

      const heading = document.createElement("strong");
      heading.textContent = item.role === "user" ? "You" : "Jarvis";

      const text = document.createElement("p");
      text.textContent = item.text;

      const date = document.createElement("small");
      date.textContent = new Date(item.createdAt).toLocaleString();

      card.append(heading, text, date);
      ui.memoryList.appendChild(card);
    });
  }

  if (ui.memoryStatus) {
    ui.memoryStatus.textContent = memory.length + " ITEMS";
  }
}

function renderHistory() {
  if (!ui.historyList) return;

  ui.historyList.replaceChildren();

  if (!sessions.length) {
    ui.historyList.textContent = "No conversations yet.";
    return;
  }

  sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.textContent = session.title || "New conversation";

    const date = document.createElement("small");
    date.textContent = new Date(session.createdAt).toLocaleString();
    button.appendChild(date);

    button.addEventListener("click", () => {
      activeSessionId = session.id;
      persistSessions();
      renderSession(session);
      showPage("assistant");
      closeSidebar();
    });

    ui.historyList.appendChild(button);
  });
}

function showPage(pageName) {
  const pages = {
    assistant: ui.assistantPage,
    memory: ui.memoryPage,
    history: ui.historyPage,
    settings: ui.settingsPage
  };

  Object.entries(pages).forEach(([name, element]) => {
    if (element) {
      element.hidden = name !== pageName;
    }
  });

  document.querySelectorAll("[data-page]").forEach((item) => {
    const active = item.dataset.page === pageName;
    item.classList.toggle("active", active);
    item.setAttribute("aria-current", active ? "page" : "false");
  });

  if (pageName === "memory") renderMemory();
  if (pageName === "history") renderHistory();
  closeSidebar();
}

function openSidebar() {
  if (ui.sidebar) ui.sidebar.classList.add("open");
  if (ui.sidebarBackdrop) ui.sidebarBackdrop.classList.add("visible");
}

function closeSidebar() {
  if (ui.sidebar) ui.sidebar.classList.remove("open");
  if (ui.sidebarBackdrop) ui.sidebarBackdrop.classList.remove("visible");
}

async function askGemini(prompt) {
  if (!API_URL || API_URL === "PASTE_YOUR_WEB_APP_URL_HERE") {
    throw new Error("Backend URL not configured. Add your Web App URL in script.js.");
  }

  // text/plain avoids the JSON content-type preflight in many browsers.
  // Apps Script redirects and cross-origin restrictions may still vary.
  const response = await fetch(API_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    throw new Error("Backend HTTP error: " + response.status);
  }

  const data = await response.json();

  if (!data.ok || !data.reply) {
    throw new Error(data.error || "Jarvis could not get a reply.");
  }

  return data.reply;
}

async function sendMessage(text) {
  const prompt = String(text || "").trim();
  if (!prompt || isSending) return;

  if (!getActiveSession()) createSession();

  isSending = true;
  if (ui.sendButton) ui.sendButton.disabled = true;

  addMessage("user", prompt);

  if (ui.messageInput) {
    ui.messageInput.value = "";
    ui.messageInput.style.height = "auto";
  }

  const pending = addMessage(
    "assistant",
    "Thinking, Boss...",
    { temporary: true }
  );

  setStatus("PROCESSING", "THINKING");
  if (ui.jarvisCore) ui.jarvisCore.classList.add("active");

  try {
    const reply = await askGemini(prompt);
    updateMessage(pending, reply);

    const session = getActiveSession();
    if (session && pending) {
      session.messages.push({
        id: makeId(),
        role: "assistant",
        text: reply,
        createdAt: new Date().toISOString()
      });

      persistSessions();
      const savedReply = session.messages[session.messages.length - 1];
      saveMemoryEntry(savedReply);
    }

    setStatus("ONLINE", "CONNECTED");
    renderHistory();
    renderMemory();
  } catch (error) {
    console.error("Jarvis request failed:", error);

    updateMessage(
      pending,
      "Connection failed: " + error.message +
      "\n\nCheck the backend URL and Apps Script permissions. If the browser reports a CORS error, we need to adjust the backend connection."
    );

    setStatus("ERROR", "CONNECTION ISSUE");
  } finally {
    isSending = false;
    if (ui.sendButton) ui.sendButton.disabled = false;
    if (ui.jarvisCore) ui.jarvisCore.classList.remove("active");
    if (ui.messageInput) ui.messageInput.focus();
  }
}

function setupVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (ui.voiceStatus) ui.voiceStatus.textContent = "NOT SUPPORTED";
    if (ui.micButton) ui.micButton.title = "Voice input not supported in this browser";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    if (ui.voiceStatus) ui.voiceStatus.textContent = "LISTENING";
    setStatus("LISTENING", "VOICE ACTIVE");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (ui.messageInput) ui.messageInput.value = transcript;
  };

  recognition.onerror = (event) => {
    console.warn("Voice input error:", event.error);
    if (ui.voiceStatus) ui.voiceStatus.textContent = "READY";
  };

  recognition.onend = () => {
    if (ui.voiceStatus) ui.voiceStatus.textContent = "READY";
    setStatus("STANDBY", "READY");
  };
}

function setupEvents() {
  if (ui.chatForm) {
    ui.chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage(ui.messageInput ? ui.messageInput.value : "");
    });
  }

  if (ui.messageInput) {
    ui.messageInput.addEventListener("input", () => {
      ui.messageInput.style.height = "auto";
      ui.messageInput.style.height =
        Math.min(ui.messageInput.scrollHeight, 160) + "px";
    });
  }

  if (ui.menuButton) ui.menuButton.addEventListener("click", openSidebar);
  if (ui.closeSidebar) ui.closeSidebar.addEventListener("click", closeSidebar);

  if (ui.sidebarBackdrop) {
    ui.sidebarBackdrop.addEventListener("click", closeSidebar);
  }

  if (ui.newChatButton) {
    ui.newChatButton.addEventListener("click", () => {
      createSession();
      showPage("assistant");
    });
  }

  document.querySelectorAll("[data-page]").forEach((item) => {
    item.addEventListener("click", () => showPage(item.dataset.page));
  });

  if (ui.clearChatButton) {
    ui.clearChatButton.addEventListener("click", () => {
      const session = getActiveSession();
      if (!session) return;

      session.messages = [];
      session.title = "New conversation";
      persistSessions();
      renderSession(session);
      renderHistory();
    });
  }

  if (ui.micButton) {
    ui.micButton.addEventListener("click", () => {
      if (recognition) {
        try {
          recognition.start();
        } catch (error) {
          console.warn("Voice recognition already active.");
        }
      } else {
        alert("Voice input is not supported in this browser. Try Chrome.");
      }
    });
  }

  if (ui.imageButton && ui.imageInput) {
    ui.imageButton.addEventListener("click", () => ui.imageInput.click());

    ui.imageInput.addEventListener("change", () => {
      const file = ui.imageInput.files && ui.imageInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please choose an image file.");
        ui.imageInput.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be smaller than 5 MB.");
        ui.imageInput.value = "";
        return;
      }

      selectedImage = file;
      if (ui.messageInput) {
        ui.messageInput.placeholder =
          "Image selected. Image analysis is not connected yet...";
      }
      alert("Image selected. This backend currently sends text only; image analysis is not connected yet.");
    });
  }

  // Text-to-speech: tap a Jarvis reply to hear it.
  if (ui.chatMessages) {
    ui.chatMessages.addEventListener("click", (event) => {
      const content = event.target.closest(".message.assistant .message-content");
      if (!content || !("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content.textContent);
      utterance.lang = "en-IN";
      window.speechSynthesis.speak(utterance);
    });
  }
}

function initJarvis() {
  if (!getActiveSession()) {
    createSession();
  } else {
    renderSession(getActiveSession());
  }

  setupEvents();
  setupVoiceInput();
  renderHistory();
  renderMemory();

  if (ui.networkStatus) {
    ui.networkStatus.textContent = navigator.onLine ? "ONLINE" : "OFFLINE";
  }

  window.addEventListener("online", () => {
    if (ui.networkStatus) ui.networkStatus.textContent = "ONLINE";
  });

  window.addEventListener("offline", () => {
    if (ui.networkStatus) ui.networkStatus.textContent = "OFFLINE";
  });

  setStatus("STANDBY", "READY");
}

document.addEventListener("DOMContentLoaded", initJarvis);
