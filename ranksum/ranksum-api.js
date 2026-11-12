const LEGACY_TIER_ORDER = ['loved', 'liked', 'okay', 'bad'];
const LIBRARY_KEYS = new Set(['movies', 'albums']);

/**
 * Target score-band frequencies (floor(score) for score in [0,10), with 10 → band 9).
 * Relative weights for N≈85: {(0,2)(1,3)(2,6)(3,9)(4,13)(5,17)(6,16)(7,10)(8,7)(9,2)}
 * Mode ~5–6; left-skewed toward mid/high scores.
 *
 * Equivalent continuous density on [0,10]:
 *   f(x) = w_{⌊x⌋} / Σw   for x ∈ [k, k+1), k = 0..9
 * Scores are the inverse-CDF of that density, discretized so band counts
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
 * Index 0 = best (highest score). Allocates ranks into score bands [0,1)…[9,10]
 * proportional to SCORE_BAND_WEIGHTS, then spaces scores within each band.
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
            // Best-first within band: first is highest. Midpoint spacing in (b, b+1].
            const score = b + 1 - (k + 0.5) / n;
            albums[i + k].score = Math.round(score * 100) / 100;
        }
        i = j;
    }

    albums[0].score = 10;
    albums[N - 1].score = 0;
}

const CURRENTLY_READING_META_KEY = 'portfolio:currently-reading';
const CURRENTLY_READING_COVER_KEY = 'portfolio:currently-reading:cover';
const DEFAULT_CURRENTLY_READING = {
    title: 'Outline',
    author: 'Rachel Cusk',
    coverPath: '/main/imgs/book1.jpg',
};
const MAX_COVER_BYTES = 2 * 1024 * 1024;

function parsePngBase64(input) {
    if (input === null) {
        return null;
    }
    if (typeof input !== 'string' || !input.trim()) {
        throw new Error('cover must be a PNG image');
    }

    let base64 = input.trim();
    const dataUrlMatch = base64.match(/^data:image\/png;base64,(.+)$/i);
    if (dataUrlMatch) {
        base64 = dataUrlMatch[1];
    }

    let bytes;
    try {
        const binary = atob(base64);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
    } catch {
        throw new Error('cover must be a PNG image');
    }

    if (
        bytes.length < 8 ||
        bytes[0] !== 0x89 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x4e ||
        bytes[3] !== 0x47
    ) {
        throw new Error('cover must be a PNG image');
    }
    if (bytes.length > MAX_COVER_BYTES) {
        throw new Error('cover image too large (max 2MB)');
    }

    return bytes;
}

async function hasCustomCurrentlyReadingCover(env) {
    assertKvBinding(env);
    const cover = await env.RANKSUM_KV.get(CURRENTLY_READING_COVER_KEY);
    return cover !== null;
}

async function readCurrentlyReadingMeta(env, requestUrl) {
    assertKvBinding(env);
    const stored = await env.RANKSUM_KV.get(CURRENTLY_READING_META_KEY);
    if (stored !== null) {
        return JSON.parse(stored);
    }
    return { ...DEFAULT_CURRENTLY_READING };
}

async function currentlyReadingPublicPayload(env, requestUrl) {
    const meta = await readCurrentlyReadingMeta(env, requestUrl);
    const customCover = await hasCustomCurrentlyReadingCover(env);
    const coverUrl = customCover
        ? '/api/ranksum/currently-reading/cover'
        : meta.coverPath || DEFAULT_CURRENTLY_READING.coverPath;

    return {
        title: meta.title || DEFAULT_CURRENTLY_READING.title,
        author: meta.author || DEFAULT_CURRENTLY_READING.author,
        coverUrl,
        updatedAt: meta.updatedAt || null,
    };
}

async function handleCurrentlyReadingGet(env, requestUrl) {
    try {
        return json(await currentlyReadingPublicPayload(env, requestUrl));
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to read currently reading';
        const status = message.includes('not configured') ? 503 : 500;
        return json({ error: message }, status);
    }
}

async function handleCurrentlyReadingCoverGet(env, requestUrl) {
    try {
        assertKvBinding(env);
        const cover = await env.RANKSUM_KV.get(CURRENTLY_READING_COVER_KEY, 'arrayBuffer');
        if (cover) {
            return new Response(cover, {
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=300',
                },
            });
        }

        const meta = await readCurrentlyReadingMeta(env, requestUrl);
        const seedUrl = new URL(meta.coverPath || DEFAULT_CURRENTLY_READING.coverPath, requestUrl);
        return env.ASSETS.fetch(new Request(seedUrl));
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to read cover';
        const status = message.includes('not configured') ? 503 : 500;
        return json({ error: message }, status);
    }
}

async function handleCurrentlyReadingPut(request, env, requestUrl) {
    if (!isAuthorized(request, env)) {
        return unauthorized();
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Invalid JSON' }, 400);
    }

    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const author = typeof body?.author === 'string' ? body.author.trim() : '';
    if (!title) {
        return json({ error: 'title is required' }, 400);
    }
    if (!author) {
        return json({ error: 'author is required' }, 400);
    }

    try {
        const meta = await readCurrentlyReadingMeta(env, requestUrl);
        meta.title = title;
        meta.author = author;
        meta.updatedAt = Date.now();

        if (body.coverBase64 !== undefined) {
            if (body.coverBase64 === null || body.coverBase64 === '') {
                await env.RANKSUM_KV.delete(CURRENTLY_READING_COVER_KEY);
                if (!meta.coverPath) {
                    meta.coverPath = DEFAULT_CURRENTLY_READING.coverPath;
                }
            } else {
                const bytes = parsePngBase64(body.coverBase64);
                await env.RANKSUM_KV.put(CURRENTLY_READING_COVER_KEY, bytes);
                delete meta.coverPath;
            }
        }

        await env.RANKSUM_KV.put(CURRENTLY_READING_META_KEY, JSON.stringify(meta));
        return json(await currentlyReadingPublicPayload(env, requestUrl));
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save currently reading';
        const status = message.includes('must be a PNG') || message.includes('too large') ? 400 : 500;
        return json({ error: message }, status);
    }
}

function kvKey(libraryKey) {
    return `library:${libraryKey}`;
}

function resolveLibraryKey(url, body) {
    const key = url.searchParams.get('library') || body?.library;
    if (key && LIBRARY_KEYS.has(key)) return key;
    if (!key) return 'movies';
    return null;
}

function parseGenresInput(genres) {
    let raw = [];
    if (Array.isArray(genres)) {
        raw = genres.map((s) => String(s).trim()).filter(Boolean);
    } else if (typeof genres === 'string') {
        raw = genres
            .split(',')
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

function normalizeAlbumForApi(album) {
    const a = { ...album };
    if (Array.isArray(a.genres)) {
        a.genres = parseGenresInput(a.genres);
    } else if (typeof a.genre === 'string' && String(a.genre).trim()) {
        a.genres = parseGenresInput(a.genre);
    } else {
        a.genres = [];
    }
    delete a.genre;
    return a;
}

function albumsForApi(data) {
    return data.albums.map(normalizeAlbumForApi);
}

function findAlbumById(data, id) {
    const idx = data.albums.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    return { index: idx, album: data.albums[idx] };
}

function migrateLegacy(raw) {
    if (Array.isArray(raw.albums)) {
        return { albums: raw.albums };
    }
    const albums = [];
    if (raw.tiers) {
        for (const tier of LEGACY_TIER_ORDER) {
            albums.push(...(raw.tiers[tier] || []));
        }
    }
    return { albums };
}

function assertKvBinding(env) {
    if (!env.RANKSUM_KV) {
        throw new Error(
            'RANKSUM_KV is not configured. In Cloudflare Pages → siruno → Settings → Functions, ' +
            'add a KV namespace binding named RANKSUM_KV (not an environment variable).'
        );
    }
    if (typeof env.RANKSUM_KV.get !== 'function') {
        throw new Error(
            'RANKSUM_KV is not a KV namespace. Remove it from Settings → Environment variables ' +
            'and add it under Settings → Functions → KV namespace bindings instead.'
        );
    }
}

async function readLibrary(libraryKey, env, requestUrl) {
    assertKvBinding(env);

    const stored = await env.RANKSUM_KV.get(kvKey(libraryKey));
    if (stored !== null) {
        return migrateLegacy(JSON.parse(stored));
    }

    const seedUrl = new URL(`/ranksum/${libraryKey}.json`, requestUrl);
    const seedRes = await env.ASSETS.fetch(new Request(seedUrl));
    if (!seedRes.ok) {
        return { albums: [] };
    }

    const data = migrateLegacy(await seedRes.json());
    recalculateScores(data.albums);
    await writeLibrary(libraryKey, data, env);
    return data;
}

async function writeLibrary(libraryKey, data, env) {
    assertKvBinding(env);
    await env.RANKSUM_KV.put(kvKey(libraryKey), JSON.stringify(data, null, 2));
}

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
        return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

export function isAuthorized(request, env) {
    const expected = env.MAIN_PASSWORD;
    if (!expected) return false;

    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return false;
    return safeEqual(auth.slice(7), expected);
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function unauthorized() {
    return json({ error: 'Unauthorized' }, 401);
}

export async function handleRanksum(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/ranksum/auth' && request.method === 'POST') {
        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }
        const password = body?.password;
        if (!env.MAIN_PASSWORD) {
            return json({ error: 'Server not configured' }, 503);
        }
        if (typeof password !== 'string' || !safeEqual(password, env.MAIN_PASSWORD)) {
            return json({ error: 'Invalid password' }, 401);
        }
        return json({ ok: true });
    }

    if (path === '/api/ranksum/libraries' && request.method === 'GET') {
        return json({
            libraries: [
                { id: 'movies', label: 'Movies' },
                { id: 'albums', label: 'Albums' },
            ],
        });
    }

    if (path === '/api/ranksum/albums' && request.method === 'GET') {
        const libraryKey = resolveLibraryKey(url, null);
        if (!libraryKey) return json({ error: 'Invalid library (use movies or albums)' }, 400);
        try {
            const data = await readLibrary(libraryKey, env, url);
            return json({ library: libraryKey, albums: albumsForApi(data) });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to read albums';
            const status = message.includes('not configured') ? 503 : 500;
            return json({ error: message }, status);
        }
    }

    if (path === '/api/ranksum/albums' && request.method === 'POST') {
        if (!isAuthorized(request, env)) return unauthorized();

        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }

        const libraryKey = resolveLibraryKey(url, body);
        if (!libraryKey) return json({ error: 'Invalid library (use movies or albums)' }, 400);

        const {
            title,
            artist,
            notes = '',
            genres,
            favoriteSongs = [],
            leastFavoriteSongs = [],
            insertIndex,
        } = body;

        if (!title || typeof title !== 'string') {
            return json({ error: 'title is required' }, 400);
        }
        if (!artist || typeof artist !== 'string') {
            return json({ error: 'artist is required' }, 400);
        }
        if (typeof insertIndex !== 'number' || !Number.isInteger(insertIndex) || insertIndex < 0) {
            return json({ error: 'insertIndex must be a non-negative integer' }, 400);
        }

        try {
            const data = await readLibrary(libraryKey, env, url);
            const list = data.albums;
            if (insertIndex > list.length) {
                return json({ error: 'insertIndex out of range' }, 400);
            }

            const album = {
                id: crypto.randomUUID(),
                title: String(title).trim(),
                artist: String(artist).trim(),
                notes: typeof notes === 'string' ? notes : '',
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
            await writeLibrary(libraryKey, data, env);

            return json(
                {
                    library: libraryKey,
                    album: normalizeAlbumForApi(album),
                    albums: albumsForApi(data),
                },
                201
            );
        } catch {
            return json({ error: 'Failed to save album' }, 500);
        }
    }

    const patchMatch = path.match(/^\/api\/ranksum\/albums\/([^/]+)$/);
    if (patchMatch && request.method === 'PATCH') {
        if (!isAuthorized(request, env)) return unauthorized();

        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }

        const libraryKey = resolveLibraryKey(url, body);
        if (!libraryKey) return json({ error: 'Invalid library (use movies or albums)' }, 400);

        const albumId = decodeURIComponent(patchMatch[1]);
        const { notes, genres, favoriteSongs, leastFavoriteSongs } = body;

        if (typeof notes !== 'string') {
            return json({ error: 'notes must be a string' }, 400);
        }
        if (genres !== undefined && !Array.isArray(genres)) {
            return json({ error: 'genres must be an array' }, 400);
        }
        if (!Array.isArray(favoriteSongs) || !Array.isArray(leastFavoriteSongs)) {
            return json({ error: 'favoriteSongs and leastFavoriteSongs must be arrays' }, 400);
        }

        try {
            const data = await readLibrary(libraryKey, env, url);
            const found = findAlbumById(data, albumId);
            if (!found) return json({ error: 'Album not found' }, 404);

            const album = found.album;
            album.notes = notes;
            if (genres !== undefined) {
                album.genres = parseGenresInput(genres);
            } else {
                album.genres = parseGenresInput(
                    album.genres !== undefined ? album.genres : album.genre
                );
            }
            delete album.genre;
            album.favoriteSongs = favoriteSongs.map((s) => String(s).trim()).filter(Boolean);
            album.leastFavoriteSongs = leastFavoriteSongs.map((s) => String(s).trim()).filter(Boolean);

            await writeLibrary(libraryKey, data, env);
            return json({
                library: libraryKey,
                album: normalizeAlbumForApi(album),
                albums: albumsForApi(data),
            });
        } catch {
            return json({ error: 'Failed to update album' }, 500);
        }
    }

    if (path === '/api/ranksum/albums/order' && request.method === 'PUT') {
        if (!isAuthorized(request, env)) return unauthorized();

        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid JSON' }, 400);
        }

        const libraryKey = resolveLibraryKey(url, body);
        if (!libraryKey) return json({ error: 'Invalid library (use movies or albums)' }, 400);

        const { ids } = body;
        if (!Array.isArray(ids)) {
            return json({ error: 'ids must be an array' }, 400);
        }

        try {
            const data = await readLibrary(libraryKey, env, url);
            const current = data.albums;
            if (ids.length !== current.length) {
                return json({ error: 'Wrong number of albums' }, 400);
            }

            const currentIds = new Set(current.map((a) => a.id));
            const seen = new Set();
            for (const id of ids) {
                if (typeof id !== 'string' || !currentIds.has(id) || seen.has(id)) {
                    return json({ error: 'Invalid id list' }, 400);
                }
                seen.add(id);
            }
            if (seen.size !== currentIds.size) {
                return json({ error: 'Missing ids' }, 400);
            }

            const byId = Object.fromEntries(current.map((a) => [a.id, a]));
            data.albums = ids.map((id) => byId[id]);
            recalculateScores(data.albums);
            await writeLibrary(libraryKey, data, env);

            return json({ library: libraryKey, albums: albumsForApi(data) });
        } catch {
            return json({ error: 'Failed to save order' }, 500);
        }
    }

    if (path === '/api/ranksum/albums/recalculate-scores' && request.method === 'POST') {
        if (!isAuthorized(request, env)) return unauthorized();

        let body = {};
        if (request.headers.get('Content-Type')?.includes('application/json')) {
            try {
                body = await request.json();
            } catch {
                return json({ error: 'Invalid JSON' }, 400);
            }
        }

        const libraryKey = resolveLibraryKey(url, body);
        if (!libraryKey) return json({ error: 'Invalid library (use movies or albums)' }, 400);

        try {
            const data = await readLibrary(libraryKey, env, url);
            recalculateScores(data.albums);
            await writeLibrary(libraryKey, data, env);
            return json({ library: libraryKey, albums: albumsForApi(data) });
        } catch {
            return json({ error: 'Failed to recalculate scores' }, 500);
        }
    }

    if (path === '/api/ranksum/currently-reading/cover' && request.method === 'GET') {
        return handleCurrentlyReadingCoverGet(env, url);
    }

    if (path === '/api/ranksum/currently-reading' && request.method === 'GET') {
        return handleCurrentlyReadingGet(env, url);
    }

    if (path === '/api/ranksum/currently-reading' && request.method === 'PUT') {
        return handleCurrentlyReadingPut(request, env, url);
    }

    return null;
}
