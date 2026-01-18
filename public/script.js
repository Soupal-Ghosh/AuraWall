const grid = document.getElementById("wallpaperGrid");
const searchInput = document.getElementById("searchInput");

let page = 1;
const batchSize = 100; // Number of images to fetch per batch from backend
let imagesList = [];
let currentIndex = 0;
let currentQuery = null;
let isLoading = false;

//create with ai btn logic 
const aiCreateBtn = document.getElementById("aiCreateBtn");
document.addEventListener("DOMContentLoaded", () => {
  if (!aiCreateBtn) {
    console.error("aicreatebtn not found");
    return;
  }

  aiCreateBtn.addEventListener("click", () => {
    window.location.href = "chat.html";
  });
});


// -------- Fetch images from backend ----------
async function fetchImagesFromBackend(query, page = 1) {
  const url = `/api/images?q=${encodeURIComponent(query || "")}&page=${page}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error("Backend API error:", text);
      return [];
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Fetch error:", err);
    return [];
  }
}

// -------- Display images in grid ----------
function displayImages(newImages) {
  newImages.forEach((imgObj) => {
    const img = document.createElement("img");
    img.src = imgObj.thumb;
    img.alt = imgObj.alt || "Wallpaper";
    img.loading = "lazy";
    img.onclick = () => openLightbox(imagesList.indexOf(imgObj));
    grid.appendChild(img);
  });
}

// -------- Load images (search or random) ----------
async function loadImages() {
  if (isLoading) return;
  isLoading = true;

  const newImages = await fetchImagesFromBackend(currentQuery, page);
  if (newImages.length === 0) {
    isLoading = false;
    return;
  }

  imagesList.push(...newImages);
  displayImages(newImages);

  page++;
  isLoading = false;
}

// -------- Search ----------
async function searchWallpapers() {
  const query = searchInput.value.trim();
  if (!query) return;

  currentQuery = query;
  page = 1;
  imagesList = [];
  grid.innerHTML = "";
  await loadImages();
}
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchWallpapers();
});

// -------- Infinite scroll ----------
window.addEventListener("scroll", () => {
  if (
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - 200
  ) {
    loadImages();
  }
});

// -------- Lightbox ----------
function showImage(index) {
  const lightboxImg = document.getElementById("lightboxImg");
  lightboxImg.classList.add("fade");
  setTimeout(() => {
    lightboxImg.src = imagesList[index].full;
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
  if (currentIndex >= imagesList.length - 2) loadImages(); // prefetch more
}

function prevImage() {
  currentIndex = (currentIndex - 1 + imagesList.length) % imagesList.length;
  showImage(currentIndex);
}

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (document.getElementById("lightbox").classList.contains("hidden")) return;
  if (e.key === "ArrowRight") nextImage();
  if (e.key === "ArrowLeft") prevImage();
  if (e.key === "Escape") closeLightbox();
});
//download image 
const downloadBtn = document.querySelector("#lightbox .slice");

downloadBtn.addEventListener("click", () => {
  if (!imagesList[currentIndex]) return;

  const imgObj = imagesList[currentIndex];
  
  // Use alt text or fallback for filename
  let filename = "wallpaper";
  if (imgObj.alt) {
    filename = imgObj.alt.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  // Preserve file extension
  if (!filename.endsWith(".jpg") && !filename.endsWith(".png")) {
    const extension = imgObj.full.split(".").pop().split(/\#|\?/)[0];
    filename += "." + extension;
  }

  // Use backend to download the image securely
  window.location.href = `/download?url=${encodeURIComponent(imgObj.full)}&filename=${filename}`;
});



// -------- Initial load ----------
loadImages();
