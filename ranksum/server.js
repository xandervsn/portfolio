const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const LEGACY_TIER_ORDER = ["loved", "liked", "okay", "bad"];

const LIBRARIES = {
  movies: path.join(__dirname, "movies.json"),
  albums: path.join(__dirname, "albums.json"),
};

app.use(express.json({ limit: "3mb" }));
app.use(express.static(path.join(__dirname, "public")));

const CURRENTLY_READING_META_PATH = path.join(__dirname, "currently-reading.json");
const CURRENTLY_READING_COVER_PATH = path.join(__dirname, "currently-reading-cover.png");
const DEFAULT_CURRENTLY_READING = {
  title: "Outline",
  author: "Rachel Cusk",
  coverPath: "/main/imgs/book1.jpg",
};

function readCurrentlyReadingMeta() {
  if (!fs.existsSync(CURRENTLY_READING_META_PATH)) {
    return { ...DEFAULT_CURRENTLY_READING };
  }
  return JSON.parse(fs.readFileSync(CURRENTLY_READING_META_PATH, "utf8"));
}

function writeCurrentlyReadingMeta(meta) {
  fs.writeFileSync(CURRENTLY_READING_META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

function hasCustomCurrentlyReadingCover() {
  return fs.existsSync(CURRENTLY_READING_COVER_PATH);
}

function currentlyReadingPublicPayload() {
  const meta = readCurrentlyReadingMeta();
  const customCover = hasCustomCurrentlyReadingCover();
  return {
    title: meta.title || DEFAULT_CURRENTLY_READING.title,
    author: meta.author || DEFAULT_CURRENTLY_READING.author,
    coverUrl: customCover
      ? "/api/ranksum/currently-reading/cover"
      : meta.coverPath || DEFAULT_CURRENTLY_READING.coverPath,
    updatedAt: meta.updatedAt || null,
  };
}

function parsePngBase64(input) {
  if (input === null) return null;
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("cover must be a PNG image");
  }
  let base64 = input.trim();
  const dataUrlMatch = base64.match(/^data:image\/png;base64,(.+)$/i);
  if (dataUrlMatch) base64 = dataUrlMatch[1];
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    throw new Error("cover must be a PNG image");
  }
  if (bytes.length > 2 * 1024 * 1024) {
    throw new Error("cover image too large (max 2MB)");
  }
  return bytes;
}

function resolveLibraryKey(req) {
  const key = req.query.library || (req.body && req.body.library);
  if (key && LIBRARIES[key]) return key;
  if (!key) return "movies";
  return null;
}

/**
 * Target score-band frequencies (floor(score) for score in [0,10), with 10 → band 9).
 * Relative weights for N≈85: {(0,2)(1,3)(2,6)(3,9)(4,13)(5,17)(6,16)(7,10)(8,7)(9,2)}
 *
 * Continuous density on [0,10]: f(x) = w_{⌊x⌋} / Σw for x ∈ [k,k+1).
 * Scores are inverse-CDF of that density, discretized so band counts
 * match the proportional allocation of N items.
 */
const SCORE_BAND_WEIGHTS = [2, 3, 6, 9, 13, 17, 16, 10, 7, 2];

function allocateBandCounts(N) {
  const total = SCORE_BAND_WEIGHTS.reduce((a, b) => a + b, 0);
  const counts = SCORE_BAND_WEIGHTS.map((w) => Math.floor((N * w) / total));
  let rem = N - counts.reduce((a, b) => a + b, 0);
  const fracs = SCORE_BAND_WEIGHTS.map((w, i) => ({
    i,
    f: (N * w) / total - counts[i],
  })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let r = 0; r < rem; r++) {
    counts[fracs[r].i]++;
  }
  return counts;
}

/**
 * Index 0 = best (highest score).
 */
function recalculateScores(albums) {
  const N = albums.length;
  if (N === 0) return;
  if (N === 1) {
    albums[0].score = 10;
    return;
  }

  const counts = allocateBandCounts(N);
  const bandsBestFirst = [];
  for (let b = 9; b >= 0; b--) {
    for (let j = 0; j < counts[b]; j++) {
      bandsBestFirst.push(b);
    }
  }

  let i = 0;
  while (i < N) {
    const b = bandsBestFirst[i];
    let j = i;
    while (j < N && bandsBestFirst[j] === b) j++;
    const n = j - i;
    for (let k = 0; k < n; k++) {
      const score = b + 1 - (k + 0.5) / n;
      albums[i + k].score = Math.round(score * 100) / 100;
    }
    i = j;
  }

  albums[0].score = 10;
  albums[N - 1].score = 0;
}

function readAlbums(libraryKey) {
  const dataPath = LIBRARIES[libraryKey];
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (Array.isArray(raw.albums)) {
    return { albums: raw.albums };
  }
  const albums = [];
  if (raw.tiers) {
    for (const tier of LEGACY_TIER_ORDER) {
      albums.push(...(raw.tiers[tier] || []));
    }
  }
  const data = { albums };
  recalculateScores(data.albums);
  writeAlbums(data, libraryKey);
  return data;
}

function writeAlbums(data, libraryKey) {
  fs.writeFileSync(LIBRARIES[libraryKey], JSON.stringify(data, null, 2), "utf8");
}

function normalizeAlbumForApi(album) {
  const a = { ...album };
  if (Array.isArray(a.genres)) {
    a.genres = parseGenresInput(a.genres);
  } else if (typeof a.genre === "string" && String(a.genre).trim()) {
    a.genres = parseGenresInput(a.genre);
  } else {
    a.genres = [];
  }
  delete a.genre;
  return a;
}

function parseGenresInput(genres) {
  let raw = [];
  if (Array.isArray(genres)) {
    raw = genres.map((s) => String(s).trim()).filter(Boolean);
  } else if (typeof genres === "string") {
    raw = genres
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const seen = new Set();
  return raw.filter((g) => {
    if (seen.has(g)) return false;
    seen.add(g);
    return true;
  });
}

function findAlbumById(data, id) {
  const idx = data.albums.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  return { index: idx, album: data.albums[idx] };
}

function albumsForApi(data) {
  return data.albums.map(normalizeAlbumForApi);
}

app.get("/libraries", (req, res) => {
  res.json({
    libraries: [
      { id: "movies", label: "Movies" },
      { id: "albums", label: "Albums" },
    ],
  });
});

app.get("/albums", (req, res) => {
  try {
    const libraryKey = resolveLibraryKey(req);
    if (!libraryKey) {
      return res.status(400).json({ error: "Invalid library (use movies or albums)" });
    }
    const data = readAlbums(libraryKey);
    res.json({ library: libraryKey, albums: albumsForApi(data) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read albums" });
  }
});

/**
 * Body: { title, artist, notes?, genres?, favoriteSongs?, leastFavoriteSongs?, insertIndex }
 */
app.post("/albums", (req, res) => {
  try {
    const libraryKey = resolveLibraryKey(req);
    if (!libraryKey) {
      return res.status(400).json({ error: "Invalid library (use movies or albums)" });
    }
    const {
      title,
      artist,
      notes = "",
      genres,
      favoriteSongs = [],
      leastFavoriteSongs = [],
      insertIndex,
    } = req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    if (!artist || typeof artist !== "string") {
      return res.status(400).json({ error: "artist is required" });
    }
    if (
      typeof insertIndex !== "number" ||
      !Number.isInteger(insertIndex) ||
      insertIndex < 0
    ) {
      return res.status(400).json({ error: "insertIndex must be a non-negative integer" });
    }

    const data = readAlbums(libraryKey);
    const list = data.albums;
    if (insertIndex > list.length) {
      return res.status(400).json({ error: "insertIndex out of range" });
    }

    const album = {
      id: crypto.randomUUID(),
      title: String(title).trim(),
      artist: String(artist).trim(),
      notes: typeof notes === "string" ? notes : "",
      genres: parseGenresInput(genres),
      favoriteSongs: Array.isArray(favoriteSongs)
        ? favoriteSongs.map((s) => String(s).trim()).filter(Boolean)
        : [],
      leastFavoriteSongs: Array.isArray(leastFavoriteSongs)
        ? leastFavoriteSongs.map((s) => String(s).trim()).filter(Boolean)
        : [],
      score: 0,
    };

    list.splice(insertIndex, 0, album);
    recalculateScores(list);
    writeAlbums(data, libraryKey);

    res.status(201).json({
      library: libraryKey,
      album: normalizeAlbumForApi(album),
      albums: albumsForApi(data),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save album" });
  }
});

app.patch("/albums/:id", (req, res) => {
  try {
    const libraryKey = resolveLibraryKey(req);
    if (!libraryKey) {
      return res.status(400).json({ error: "Invalid library (use movies or albums)" });
    }
    const { id } = req.params;
    const { notes, genres, favoriteSongs, leastFavoriteSongs } = req.body;

    if (typeof notes !== "string") {
      return res.status(400).json({ error: "notes must be a string" });
    }
    if (genres !== undefined && !Array.isArray(genres)) {
      return res.status(400).json({ error: "genres must be an array" });
    }
    if (!Array.isArray(favoriteSongs) || !Array.isArray(leastFavoriteSongs)) {
      return res.status(400).json({ error: "favoriteSongs and leastFavoriteSongs must be arrays" });
    }

    const data = readAlbums(libraryKey);
    const found = findAlbumById(data, id);
    if (!found) {
      return res.status(404).json({ error: "Album not found" });
    }

    const album = found.album;
    album.notes = notes;
    if (genres !== undefined) {
      album.genres = parseGenresInput(genres);
    } else {
      album.genres = parseGenresInput(album.genres !== undefined ? album.genres : album.genre);
    }
    delete album.genre;
    album.favoriteSongs = favoriteSongs.map((s) => String(s).trim()).filter(Boolean);
    album.leastFavoriteSongs = leastFavoriteSongs.map((s) => String(s).trim()).filter(Boolean);

    writeAlbums(data, libraryKey);
    res.json({
      library: libraryKey,
      album: normalizeAlbumForApi(album),
      albums: albumsForApi(data),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update album" });
  }
});

/**
 * Body: { ids: [id, ...] } — full ordered list, index 0 = best.
 */
app.put("/albums/order", (req, res) => {
  try {
    const libraryKey = resolveLibraryKey(req);
    if (!libraryKey) {
      return res.status(400).json({ error: "Invalid library (use movies or albums)" });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "ids must be an array" });
    }

    const data = readAlbums(libraryKey);
    const current = data.albums;
    if (ids.length !== current.length) {
      return res.status(400).json({ error: "Wrong number of albums" });
    }

    const currentIds = new Set(current.map((a) => a.id));
    const seen = new Set();
    for (const id of ids) {
      if (typeof id !== "string" || !currentIds.has(id) || seen.has(id)) {
        return res.status(400).json({ error: "Invalid id list" });
      }
      seen.add(id);
    }
    if (seen.size !== currentIds.size) {
      return res.status(400).json({ error: "Missing ids" });
    }

    const byId = Object.fromEntries(current.map((a) => [a.id, a]));
    data.albums = ids.map((id) => byId[id]);
    recalculateScores(data.albums);
    writeAlbums(data, libraryKey);

    res.json({ library: libraryKey, albums: albumsForApi(data) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

/** Re-apply curve scores from current list order (index 0 = best). */
app.post("/albums/recalculate-scores", (req, res) => {
  try {
    const libraryKey = resolveLibraryKey(req);
    if (!libraryKey) {
      return res.status(400).json({ error: "Invalid library (use movies or albums)" });
    }
    const data = readAlbums(libraryKey);
    recalculateScores(data.albums);
    writeAlbums(data, libraryKey);
    res.json({ library: libraryKey, albums: albumsForApi(data) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to recalculate scores" });
  }
});

app.get("/currently-reading", (req, res) => {
  try {
    res.json(currentlyReadingPublicPayload());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read currently reading" });
  }
});

app.get("/currently-reading/cover", (req, res) => {
  try {
    if (hasCustomCurrentlyReadingCover()) {
      return res.type("png").sendFile(CURRENTLY_READING_COVER_PATH);
    }
    const meta = readCurrentlyReadingMeta();
    const coverPath = path.join(__dirname, "..", meta.coverPath || DEFAULT_CURRENTLY_READING.coverPath);
    return res.sendFile(coverPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to read cover" });
  }
});

app.put("/currently-reading", (req, res) => {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
    if (!title) return res.status(400).json({ error: "title is required" });
    if (!author) return res.status(400).json({ error: "author is required" });

    const meta = readCurrentlyReadingMeta();
    meta.title = title;
    meta.author = author;
    meta.updatedAt = Date.now();

    if (req.body.coverBase64 !== undefined) {
      if (req.body.coverBase64 === null || req.body.coverBase64 === "") {
        if (fs.existsSync(CURRENTLY_READING_COVER_PATH)) {
          fs.unlinkSync(CURRENTLY_READING_COVER_PATH);
        }
        if (!meta.coverPath) meta.coverPath = DEFAULT_CURRENTLY_READING.coverPath;
      } else {
        const bytes = parsePngBase64(req.body.coverBase64);
        fs.writeFileSync(CURRENTLY_READING_COVER_PATH, bytes);
        delete meta.coverPath;
      }
    }

    writeCurrentlyReadingMeta(meta);
    res.json(currentlyReadingPublicPayload());
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to save currently reading";
    const status = message.includes("must be a PNG") || message.includes("too large") ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`RankSum listening at http://localhost:${PORT}`);
});
