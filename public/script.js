const grid        = document.getElementById("wallpaperGrid");
const searchInput = document.getElementById("searchInput");
const spinner     = document.getElementById("loadingSpinner");
const emptyState  = document.getElementById("emptyState");
const errorState  = document.getElementById("errorState");

let page         = 1;
let imagesList   = [];
let currentIndex = 0;
let currentQuery = null;
let isLoading    = false;
let hasError     = false;

// ─── UI State Helpers ─────────────────────────────────────────────────────────

function showSpinner()  { spinner.classList.remove("hidden"); }
function hideSpinner()  { spinner.classList.add("hidden"); }
function showEmpty(q)   { document.getElementById("emptyQuery").textContent = q; emptyState.classList.remove("hidden"); }
function hideEmpty()    { emptyState.classList.add("hidden"); }
function showError()    { errorState.classList.remove("hidden"); }
function hideError()    { errorState.classList.add("hidden"); }

// ─── AI Create Button ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  const aiCreateBtn = document.getElementById("aiCreateBtn");
  if (!aiCreateBtn) { console.error("aiCreateBtn not found"); return; }
  aiCreateBtn.addEventListener("click", () => { window.location.href = "chat.html"; });
});

// ─── Fetch Images ─────────────────────────────────────────────────────────────

async function fetchImagesFromBackend(query, page = 1) {
  const url = `/api/images?q=${encodeURIComponent(query || "")}&page=${page}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Backend API error:", res.status);
      return null; // null = error (vs [] = empty)
    }
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

// ─── Display Images ───────────────────────────────────────────────────────────

function displayImages(newImages) {
  newImages.forEach((imgObj) => {
    const img = document.createElement("img");
    img.src = imgObj.thumb;
    img.alt = imgObj.alt || "Wallpaper";
    img.loading = "lazy";
    // FIX: use addEventListener instead of onclick
    img.addEventListener("click", () => openLightbox(imagesList.indexOf(imgObj)));
    grid.appendChild(img);
  });
}

// ─── Load Images ──────────────────────────────────────────────────────────────

async function loadImages() {
  if (isLoading) return;
  isLoading = true;
  hasError  = false;

  hideEmpty();
  hideError();
  showSpinner();

  const data = await fetchImagesFromBackend(currentQuery, page);

  hideSpinner();

  // null = network/server error
  if (data === null) {
    hasError = true;
    showError();
    isLoading = false;
    return;
  }

  // empty array = no results
  if (data.length === 0 && imagesList.length === 0) {
    showEmpty(currentQuery || "wallpaper");
    isLoading = false;
    return;
  }

  imagesList.push(...data);
  displayImages(data);
  page++;
  isLoading = false;
}

// ─── Retry ────────────────────────────────────────────────────────────────────

function retryLoad() {
  hideError();
  loadImages();
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function searchWallpapers() {
  const query = searchInput.value.trim();
  if (!query) return;

  currentQuery = query;
  page         = 1;
  imagesList   = [];
  grid.innerHTML = "";

  await loadImages();
}

// FIX: Debounce — avoids firing on every keystroke
let debounceTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (searchInput.value.trim().length > 2) searchWallpapers();
  }, 500); // waits 500ms after user stops typing
});

// Enter key search
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    clearTimeout(debounceTimer);
    searchWallpapers();
  }
});

// FIX: Search button click for mobile users
document.getElementById("searchBtn").addEventListener("click", () => {
  clearTimeout(debounceTimer);
  searchWallpapers();
});

// ─── Infinite Scroll ──────────────────────────────────────────────────────────

window.addEventListener("scroll", () => {
  if (hasError) return; // don't auto-load if there was an error
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
    loadImages();
  }
});

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function showImage(index) {
  const lightboxImg = document.getElementById("lightboxImg");
  lightboxImg.classList.add("fade");
  setTimeout(() => {
    lightboxImg.src = imagesList[index].full;
    lightboxImg.alt = imagesList[index].alt || "Wallpaper";
    lightboxImg.classList.remove("fade");
  }, 200);
}

function openLightbox(index) {
  currentIndex = index;
  document.getElementById("lightbox").classList.remove("hidden");
  showImage(currentIndex);
}

function closeLightbox() {
  document.getElementById("lightbox").classList.add("hidden");
}

function nextImage() {
  currentIndex = (currentIndex + 1) % imagesList.length;
  showImage(currentIndex);
  if (currentIndex >= imagesList.length - 2) loadImages(); // prefetch
}

function prevImage() {
  currentIndex = (currentIndex - 1 + imagesList.length) % imagesList.length;
  showImage(currentIndex);
}

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (document.getElementById("lightbox").classList.contains("hidden")) return;
  if (e.key === "ArrowRight") nextImage();
  if (e.key === "ArrowLeft")  prevImage();
  if (e.key === "Escape")     closeLightbox();
});
// FIX: Using correct ID selector instead of querySelector("#lightbox .slice")
const downloadBtn = document.getElementById("lightboxDownloadBtn");
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!imagesList[currentIndex]) return;
    const imgObj = imagesList[currentIndex];

    let filename = "wallpaper";
    if (imgObj.alt) {
      filename = imgObj.alt.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    }
    if (!filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
      const ext = imgObj.full.split(".").pop().split(/[#?]/)[0].slice(0, 5);
      filename += "." + (ext || "jpg");
    }

    // FIX: Use a temp <a> tag instead of window.location.href to avoid page flicker
    const a = document.createElement("a");
    a.href = `/download?url=${encodeURIComponent(imgObj.full)}&filename=${encodeURIComponent(filename)}`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}
loadImages();