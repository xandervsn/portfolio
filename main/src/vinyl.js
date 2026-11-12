const REFRESH_MS = 180_000;

function updateVinylWidget(artist, title, imageUrl) {
    const artistEl = document.getElementById('vinyl-artist');
    const titleEl = document.getElementById('vinyl-album');
    const coverEl = document.getElementById('vinyl-cover');

    if (artistEl) {
        artistEl.textContent = artist || 'Not playing';
    }

    if (titleEl) {
        titleEl.textContent = title || '';
    }

    if (coverEl && imageUrl) {
        coverEl.src = imageUrl;
    }
}

async function refreshVinylWidget() {
    try {
        const { artist, title, imageUrl } = await fetchNowPlaying();
        updateVinylWidget(artist, title, imageUrl);
    } catch (error) {
        console.error('Failed to load Last.fm now playing:', error);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    refreshVinylWidget();
    setInterval(refreshVinylWidget, REFRESH_MS);
});
