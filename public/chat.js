const textarea = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const chatArea = document.querySelector(".chat-area");
const imageTemplate = document.getElementById("imageMessageTemplate");

/* ---------- Auto resize ---------- */
const autoResize = () => {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
};
textarea.addEventListener("input", autoResize);

/* ---------- Text message ---------- */
const addTextMessage = (text, sender) => {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
  return msg;
};

/* ---------- Image message (TEMPLATE-BASED) ---------- */
const addImageMessage = (src) => {
  if (!src) {
    console.error("❌ Image src missing");
    return;
  }

  // Clone template
  const fragment = imageTemplate.content.cloneNode(true);

  const wrapper = fragment.querySelector(".message.image");
  const img = fragment.querySelector(".ai-image");
  const actions = fragment.querySelector(".image-actions");

  // IMPORTANT: select buttons explicitly
  const downloadBtn = actions.querySelector(".download-btn");
  const shareBtn = actions.querySelector(".share-btn");

  img.src = src;

  /* Toggle action panel */
  img.addEventListener("click", () => {
    actions.classList.toggle("hidden");
  });

  /* Download as FILE */
  if (downloadBtn) {
    downloadBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "aurawall-ai.png";
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Download failed");
    }
  });
  }

  /* (Optional) Share image file - shareBtn if present */
};

/* ---------- Generate ---------- */
generateBtn.addEventListener("click", async () => {
  const prompt = textarea.value.trim();
  if (!prompt) return;

  addTextMessage(prompt, "user");
  textarea.value = "";
  autoResize();

  const loadingMsg = addTextMessage("Generating wallpaper…", "ai");

  try {
    const res = await fetch("/api/generate-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    loadingMsg.remove();

    if (!res.ok || data.error || !data.image) {
      addTextMessage(data?.error || "Failed to generate image.", "ai");
      return;
    }
    addImageMessage(data.image);
  } catch (err) {
    console.error(err);
    loadingMsg.textContent = "Failed to generate image.";
  }
});
