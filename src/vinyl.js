const optionsLast = {
    // https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=p4pillio&api_key=KEY
    api: "https://ws.audioscrobbler.com/2.0/?format=json&",
    getRecentTracks: "method=user.getrecenttracks&",
    user: "user=p4pillio&",
    apiKey: "api_key=" + getLastKey().toString(),
};



