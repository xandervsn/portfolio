function coverUrlWithCacheBust(coverUrl, updatedAt) {
    if (!coverUrl) {
        return coverUrl;
    }
    if (!updatedAt) {
        return coverUrl;
    }
    const sep = coverUrl.includes('?') ? '&' : '?';
    return `${coverUrl}${sep}v=${encodeURIComponent(updatedAt)}`;
}

function updateReadingWidget({ title, author, coverUrl, updatedAt }) {
    const authorEl = document.getElementById('reading-author');
    const titleEl = document.getElementById('reading-title');
    const frontEl = document.getElementById('reading-cover-front');
    const backEl = document.getElementById('reading-cover-back');
    const src = coverUrlWithCacheBust(coverUrl, updatedAt);

    if (authorEl) {
        authorEl.textContent = author || '';
    }

    if (titleEl) {
        titleEl.textContent = title || '';
    }

    if (frontEl && src) {
        frontEl.src = src;
        frontEl.alt = title && author ? `${title} by ${author}` : '';
    }

    if (backEl && src) {
        backEl.src = src;
    }
}

async function refreshCurrentlyReading() {
    try {
        const data = await fetchCurrentlyReading();
        updateReadingWidget(data);
    } catch (error) {
        console.error('Failed to load currently reading:', error);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    refreshCurrentlyReading();
});
