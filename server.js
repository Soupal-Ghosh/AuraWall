// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream";
import { promisify } from "util";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve frontend from 'public'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API Keys from .env
const UNSPLASH_KEY = process.env.UNSPLASH_KEY;
const PEXELS_KEY = process.env.PEXELS_KEY;
const PIXABAY_KEY = process.env.PIXABAY_KEY;

// ---------- Helper functions ----------
async function fetchJSON(url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      console.error("API Error:", text); // keep only errors
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("Fetch Error:", err); // keep only errors
    return [];
  }
}

// ---------- Unsplash ----------
async function fetchUnsplash(query, page = 1, perPage = 30) {
  const url = query
    ? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        query
      )}&page=${page}&per_page=${perPage}`
    : `https://api.unsplash.com/photos/random?count=${perPage}`;

  const headers = { Authorization: `Client-ID ${UNSPLASH_KEY}` };
  const data = await fetchJSON(url, headers);

  if (query) {
    return (data.results || []).map((img) => ({
      thumb: img.urls.small,
      full: img.urls.full,
      alt: img.alt_description,
    }));
  } else {
    return (data || []).map((img) => ({
      thumb: img.urls.small,
      full: img.urls.full,
      alt: img.alt_description,
    }));
  }
}

// ---------- Pexels ----------
async function fetchPexels(query, perPage = 30) {
  const url = query
    ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query
      )}&per_page=${perPage}`
    : `https://api.pexels.com/v1/curated?per_page=${perPage}`;

  const headers = { Authorization: PEXELS_KEY };
  const data = await fetchJSON(url, headers);

  if (!data.photos) return [];
  return data.photos.map((img) => ({
    thumb: img.src.medium,
    full: img.src.original,
    alt: img.alt,
  }));
}

// ---------- Pixabay ----------
async function fetchPixabay(query, perPage = 30) {
  const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(
    query || "wallpaper"
  )}&image_type=photo&per_page=${perPage}`;

  const data = await fetchJSON(url);
  if (!data.hits) return [];
  return data.hits.map((img) => ({
    thumb: img.previewURL,
    full: img.largeImageURL,
    alt: img.tags,
  }));
}

// ---------- API Endpoint ----------
app.get("/api/images", async (req, res) => {
  const query = req.query.q || null;
  const page = parseInt(req.query.page || 1);

  try {
    const [unsplash, pexels, pixabay] = await Promise.all([
      fetchUnsplash(query, page),
      fetchPexels(query),
      fetchPixabay(query),
    ]);

    // Combine all results
    const allImages = [...unsplash, ...pexels, ...pixabay];
    res.json(allImages);
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// ---------- NEW Download Route ----------
const streamPipeline = promisify(pipeline);

app.get("/download", async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send("Image URL is required");

  try {
    // Fetch the image from the original source
    const response = await fetch(url);
    if (!response.ok) return res.status(500).send("Failed to fetch image");

    // Set headers to trigger download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename || "wallpaper.jpg"}"`
    );
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");

    // Stream the image directly to client
    await streamPipeline(response.body, res);
  } catch (err) {
    console.error("Download Error:", err);
    res.status(500).send("Error downloading image");
  }
});
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
