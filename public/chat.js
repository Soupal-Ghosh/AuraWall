const textarea    = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const chatArea    = document.getElementById("chatArea");
const placeholder = document.getElementById("placeholder");
const imageTemplate = document.getElementById("imageMessageTemplate");
const charCountEl = document.getElementById("charCount");

// ─── Character Counter ────────────────────────────────────────────────────────

textarea.addEventListener("input", () => {
  const len = textarea.value.length;
  charCountEl.textContent = len;

  // Visual warning as user approaches limit
  const counter = charCountEl.parentElement;
  counter.classList.toggle("warn",  len >= 400 && len < 500);
  counter.classList.toggle("limit", len >= 500);

  autoResize();
});

// ─── Auto Resize Textarea ─────────────────────────────────────────────────────

const autoResize = () => {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
};

// ─── Ctrl+Enter to Generate ───────────────────────────────────────────────────

textarea.addEventListener("keydown", (e) => {
  // FIX: Ctrl+Enter (or Cmd+Enter on Mac) submits; Enter alone = new line
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    generateBtn.click();
  }
});

// ─── Text Message ─────────────────────────────────────────────────────────────

const addTextMessage = (text, sender, isLoading = false) => {
  const msg = document.createElement("div");
  msg.className = `message ${sender}${isLoading ? " loading" : ""}`;
  msg.textContent = text;
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
  return msg;
};

// ─── Image Message ────────────────────────────────────────────────────────────

const addImageMessage = (src) => {
  if (!src) { console.error("Image src missing"); return; }

  const fragment = imageTemplate.content.cloneNode(true);
  const img      = fragment.querySelector(".ai-image");
  const actions  = fragment.querySelector(".image-actions");
  const downloadBtn = actions.querySelector(".download-btn");

  // FIX: shareBtn was referenced but never existed in HTML — removed safely
  img.src = src;

  // Toggle action panel on image click
  img.addEventListener("click", () => actions.classList.toggle("hidden"));

  // Download
  if (downloadBtn) {
    downloadBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error("Fetch failed");

        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = "aurawall-ai.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed:", err);
        addTextMessage("Download failed. Try right-clicking the image and saving.", "ai");
      }
    });
  }

  chatArea.appendChild(fragment);
  chatArea.scrollTop = chatArea.scrollHeight;
};

// ─── Generate ─────────────────────────────────────────────────────────────────

generateBtn.addEventListener("click", async () => {
  const prompt = textarea.value.trim();

  // FIX: Visible feedback for empty prompt instead of silent return
  if (!prompt) {
    textarea.style.borderColor = "#ef4444";
    setTimeout(() => textarea.style.borderColor = "", 1000);
    return;
  }

  // FIX: Prompt length guard matching server-side limit
  if (prompt.length > 500) {
    addTextMessage("Prompt too long — please keep it under 500 characters.", "ai");
    return;
  }

  // Hide placeholder on first generation
  if (placeholder) placeholder.style.display = "none";

  // Add user message
  addTextMessage(prompt, "user");
  textarea.value = "";
  charCountEl.textContent = "0";
  charCountEl.parentElement.classList.remove("warn", "limit");
  autoResize();

  // FIX: Disable button during generation to prevent spam
  generateBtn.disabled = true;
  generateBtn.classList.add("generating");
  generateBtn.textContent = "Generating";

  const loadingMsg = addTextMessage("✨ Creating your wallpaper…", "ai", true);

  try {
    const res  = await fetch("/api/generate-ai", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ prompt }),
    });

    const data = await res.json();
    loadingMsg.remove();

    if (!res.ok || data.error || !data.image) {
      addTextMessage(data?.error || "Failed to generate image. Please try again.", "ai");
      return;
    }

    addImageMessage(data.image);
    addTextMessage("✅ Click the image to reveal download options.", "ai");

  } catch (err) {
    console.error("Generation error:", err);
    loadingMsg.textContent = "⚠️ Network error — please check your connection and try again.";
    loadingMsg.classList.remove("loading");
  } finally {
    // FIX: Always re-enable button whether success or failure
    generateBtn.disabled = false;
    generateBtn.classList.remove("generating");
    generateBtn.textContent = "Generate";
  }
});