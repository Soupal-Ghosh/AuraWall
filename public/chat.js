const textarea = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const chatArea = document.querySelector(".chat-area");
const imageTemplate = document.getElementById("imageMessageTemplate");

// ---------- Auto resize ----------
const autoResize = () => {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
};

textarea.addEventListener("input", autoResize);

// ---------- Text message ----------
const addTextMessage = (text, sender) => {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;

  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
  return msg;
};

// ---------- Image message (TEMPLATE-BASED) ----------
const addImageMessage = (src) => {
  if (!src) {
    console.error("Image src is missing");
    return;
  }

  const clone = imageTemplate.content.cloneNode(true);

  const img = clone.querySelector(".ai-image");
  const actions = clone.querySelector(".image-actions");
  const downloadBtn = actions.querySelector("button");

  img.src = src;

  // Toggle actions on image click
  img.addEventListener("click", () => {
    actions.classList.toggle("hidden");
  });

  // Download image as FILE (not new tab)
  downloadBtn.addEventListener("click", async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = blobUrl;
      a.download = "aurawall-ai.png";
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download image");
    }
  });

  // ✅ Append the TEMPLATE CLONE (not inner nodes)
  chatArea.appendChild(clone);
  chatArea.scrollTop = chatArea.scrollHeight;
};

// ---------- Generate ----------
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
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    loadingMsg.remove();

    addImageMessage(data.image);
  } catch (err) {
    console.error(err);
    loadingMsg.textContent = "Failed to generate image.";
  }
});
