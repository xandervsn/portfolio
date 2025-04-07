const optionsLast = {
    // https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=p4pillio&api_key=KEY
    api: "https://ws.audioscrobbler.com/2.0/?format=json&",
    getRecentTracks: "method=user.getrecenttracks&",
    user: "user=p4pillio&",
    apiKey: "api_key=" + getLastKey().toString(),
};

async function getLastTracks() {
    const url = optionsLast.api + optionsLast.getRecentTracks + optionsLast.user + optionsLast.apiKey;
    let data = await fm_fetch(url);
    let currentTrack = data.recenttracks.track[0];
    let trackName = currentTrack.name;
    let trackArtist = currentTrack.artist["#text"];
    let trackImage = currentTrack.image[1]["#text"];
    track.innerText = trackName;
    artist.innerText = trackArtist;
    document.querySelector('.vinyl-album').style.backgroundImage = `url('${trackImage}')`;
}

async function fm_fetch(url){
    const res = await fetch(url)
    const data = await res.json()
    return data;
}

window.onload = function() {
    getLastTracks();
};