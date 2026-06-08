// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Bytez from "bytez.js";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import compression from "compression";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security & Performance Middleware ────────────────────────────────────────

// FIX 3: Security headers (helmet)
app.use(helmet());

// FIX 9: Gzip compression for faster responses
app.use(compression());

// FIX 2: Lock CORS to your own domain only
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://aurawall.onrender.com"
}));

app.use(express.json());

// FIX 1: Rate limiters — protect API quotas from abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // AI generation is expensive — strict limit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please wait a moment." }
});

// Apply rate limiters to routes
app.use("/api/images", generalLimiter);
app.use("/api/generate-ai", aiLimiter);
app.use("/download", generalLimiter);
app.use("/api/proxy-image", generalLimiter);

// ─── Static Files ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── API Keys ─────────────────────────────────────────────────────────────────

const UNSPLASH_KEY = process.env.UNSPLASH_KEY;
const PEXELS_KEY   = process.env.PEXELS_KEY;
const PIXABAY_KEY  = process.env.PIXABAY_KEY;
const BYTES_KEY    = process.env.BYTES_KEY;

// Bytez: only init when BYTES_KEY is set
let sdModel = null;
if (BYTES_KEY) {
  const bytez = new Bytez(BYTES_KEY);
  sdModel = bytez.model("stabilityai/stable-diffusion-xl-base-1.0");
}

// ─── SSRF Protection ──────────────────────────────────────────────────────────

/** Reject URLs that could be used for SSRF (localhost, private IPs). */
function isUrlSafe(urlString) {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "") return false;
    if (host === "::1") return false;
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
      if (a === 127) return false;
      if (a === 10)  return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168)          return false;
      if (a === 169 && b === 254)          return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─── AI Generation ────────────────────────────────────────────────────────────

app.post("/api/generate-ai", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  // FIX 4: Limit prompt length to prevent abuse
  if (prompt.length > 500) {
    return res.status(400).json({ error: "Prompt too long (max 500 characters)" });
  }

  if (!sdModel) {
    return res.status(503).json({ error: "AI generation not configured (BYTES_KEY missing)" });
  }

  try {
    const result = await sdModel.run(prompt);

    // FIX 7: Removed debug log (was logging large response data to production)
    if (!result || result.error || typeof result.output !== "string") {
      console.error("Invalid Bytez response:", result?.error || "unknown");
      return res.status(500).json({ error: "AI generation failed" });
    }

    res.json({
      image: `/api/proxy-image?url=${encodeURIComponent(result.output)}`,
    });
  } catch (err) {
    console.error("AI Server Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Image Proxy ──────────────────────────────────────────────────────────────

app.get("/api/proxy-image", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url");
  if (!isUrlSafe(String(url))) return res.status(400).send("Invalid or disallowed url");

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Proxy fetch failed:", response.status);
      return res.status(500).send("Failed to fetch image");
    }

    // FIX 5: Reject non-image content types
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(400).send("URL does not point to an image");
    }

    // FIX 5: Reject oversized files (10MB max)
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return res.status(400).send("Image too large (max 10MB)");
    }

    res.setHeader("Content-Type", contentType);
    response.body.pipe(res);
  } catch (err) {
    console.error("Proxy Error:", err.message);
    res.status(500).send("Proxy error");
  }
});

// ─── Helper: Fetch with Timeout ───────────────────────────────────────────────

// FIX 6: AbortController timeout on all external API calls (8 seconds)
async function fetchJSON(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      console.error("API Error:", res.status, text.slice(0, 200));
      return [];
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.error("Request timed out:", url);
    } else {
      console.error("Fetch Error:", err.message);
    }
    return [];
  }
}

// ─── Image Sources ────────────────────────────────────────────────────────────

async function fetchUnsplash(query, page = 1, perPage = 30) {
  const url = query
    ? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`
    : `https://api.unsplash.com/photos/random?count=${perPage}`;

  const data = await fetchJSON(url, { Authorization: `Client-ID ${UNSPLASH_KEY}` });

  if (query) {
    return (data.results || []).map((img) => ({
      thumb: img.urls.small,
      full:  img.urls.full,
      alt:   img.alt_description,
    }));
  }
  return (data || []).map((img) => ({
    thumb: img.urls.small,
    full:  img.urls.full,
    alt:   img.alt_description,
  }));
}

async function fetchPexels(query, perPage = 30) {
  const url = query
    ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`
    : `https://api.pexels.com/v1/curated?per_page=${perPage}`;

  const data = await fetchJSON(url, { Authorization: PEXELS_KEY });
  if (!data.photos) return [];

  return data.photos.map((img) => ({
    thumb: img.src.medium,
    full:  img.src.original,
    alt:   img.alt,
  }));
}

async function fetchPixabay(query, perPage = 30) {
  const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query || "wallpaper")}&image_type=photo&per_page=${perPage}`;
  const data = await fetchJSON(url);
  if (!data.hits) return [];

  return data.hits.map((img) => ({
    thumb: img.previewURL,
    full:  img.largeImageURL,
    alt:   img.tags,
  }));
}

// ─── Images Endpoint ──────────────────────────────────────────────────────────

app.get("/api/images", async (req, res) => {
  const query = req.query.q || null;
  const page  = parseInt(req.query.page || 1);

  try {
    const [unsplash, pexels, pixabay] = await Promise.all([
      fetchUnsplash(query, page),
      fetchPexels(query),
      fetchPixabay(query),
    ]);

    const allImages = [...unsplash, ...pexels, ...pixabay];
    res.json(allImages);
  } catch (err) {
    console.error("Server Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Download Route ───────────────────────────────────────────────────────────

app.get("/download", async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send("Image URL is required");
  if (!isUrlSafe(String(url))) return res.status(400).send("Invalid or disallowed url");

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(500).send("Failed to fetch image");

    const safeName = (filename || "wallpaper.png")
      .replace(/[^a-zA-Z0-9_\-.]/g, "_")
      .slice(0, 200);

    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");

    response.body.pipe(res);
  } catch (err) {
    console.error("Download Error:", err.message);
    res.status(500).send("Error downloading image");
  }
});

// ─── Server + Graceful Shutdown ───────────────────────────────────────────────

// FIX 8: Graceful shutdown — Render sends SIGTERM before stopping the server.
// Without this, active requests get cut off mid-response.
const server = app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});