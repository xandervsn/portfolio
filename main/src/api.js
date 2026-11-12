const API_BASE = '/api';

async function parseJsonResponse(res, label) {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(
            `${label} returned non-JSON (${res.status}). ` +
            `_worker.js may not be deployed. ` +
            `Response starts with: ${text.slice(0, 120)}`
        );
    }
    return res.json();
}

async function fm_fetch(url) {
    const res = await fetch(`${API_BASE}/lastfm?query=${encodeURIComponent(url)}`);
    if (!res.ok) {
        throw new Error(`Last.fm proxy request failed (${res.status})`);
    }
    return parseJsonResponse(res, 'lastfm endpoint');
}

async function fetchNowPlaying() {
    const res = await fetch(`${API_BASE}/now-playing`);
    if (!res.ok) {
        throw new Error(`Now playing request failed (${res.status})`);
    }
    return parseJsonResponse(res, 'now-playing endpoint');
}

async function fetchCurrentlyReading() {
    const res = await fetch(`${API_BASE}/ranksum/currently-reading`);
    if (!res.ok) {
        throw new Error(`Currently reading request failed (${res.status})`);
    }
    return parseJsonResponse(res, 'currently-reading endpoint');
}
