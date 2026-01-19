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
  const clone = imageTemplate.content.cloneNode(true);

  const wrapper = clone.querySelector(".message.image");
  const img = clone.querySelector(".ai-image");
  const actions = clone.querySelector(".image-actions");

  // Buttons (match your HTML)
  const buttons = actions.querySelectorAll("button");
  const downloadBtn = buttons[0];
  const shareBtn = buttons[1] || buttons[2];

  img.src = src;

  // Toggle action panel
  img.addEventListener("click", () => {
    actions.classList.toggle("hidden");
  });

  // Download
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

  // Share
  shareBtn.addEventListener("click", async () => {
    if (navigator.share) {
      await navigator.share({
        title: "AuraWall AI Wallpaper",
        url: src
      });
    } else {
      await navigator.clipboard.writeText(src);
      alert("Image link copied!");
    }
  });

  chatArea.appendChild(wrapper);
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
