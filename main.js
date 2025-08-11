document.addEventListener('DOMContentLoaded', function() {
    // Function to update Spotify data
    function updateSpotifyData(track, artist) {
        const trackElement = document.getElementById('track');
        const artistElement = document.getElementById('artist');
        if (trackElement && artistElement) {
            trackElement.textContent = track || 'Not playing';
            artistElement.textContent = artist || '';
        }
    }
    
    // Listen for Spotify data updates from the vinyl.js script
    window.addEventListener('spotifyDataUpdate', function(event) {
        updateSpotifyData(event.detail.track, event.detail.artist);
    });
});
