const optionsLast = {
    // https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=p4pillio&api_key=ac172dfb9e833c488a822d2249b69fc6
    api: "https://ws.audioscrobbler.com/2.0/?format=json&",
    getRecentTracks: "method=user.getrecenttracks&",
    user: "user=p4pillio&",
    apiKey: "api_key=" + getLastKey().toString(),
};



