const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const optionsThis = {
    artist_on: false,
    album_on: false,
    genre_on: false,
    deezer_on: false,
    stopped: false,
};

const optionsLast = {
    api: "https://ws.audioscrobbler.com/2.0/?format=json&",
    apiKey: "api_key=" + getLastKey().toString(),
    limit: "limit=200&",
    //overall | 7day | 1month | 3month | 6month | 12month 
    period: `period=${range.options[range.selectedIndex].value}&`,
    getTopTracks: "method=user.gettoptracks&",
    getInfo: "method=track.getInfo&",
    artist: "artist=&",
    track: "track=&",
    user: "",
};

const optionsDeezer = {
	method: 'GET',
	headers: {
		'X-RapidAPI-Key': getDeezerKey(),
		'X-RapidAPI-Host': 'deezerdevs-deezer.p.rapidapi.com'
	}
};

function init(input, artist_on_init, album_on_init, genre_on_init, deezer_on_init){
    optionsThis.artist_on = artist_on_init;
    optionsThis.album_on = album_on_init;
    optionsThis.genre_on = genre_on_init;
    optionsThis.deezer_on = deezer_on_init;
    optionsThis.stopped = false;
    optionsLast.user = input;
    optionsLast.period = `period=${range.options[range.selectedIndex].value}&`
    scrape();
}

class artist_obj {
    artist = "";
    playtime = "";
};

class album_obj {
    album = "";
    artist = "";
    playtime = "";
};

class obj {
    rank = 0;
    title = "";
    artist = "";
    playtime = 0;
    length = 0;
    scrobbles = 0;
    rankfm = 0;
    percent = 0;
    album = "";
    genre = "";
}

const maps = {
    errors: new Array(),
    artists: new Map(),
    genres: new Map(),
    albums: new Map(),
    tracks: new Map()
}

const arrays = {
    artists: new Array(),
    genres: new Array(),
    albums: new Array(),
    tracks: new Array()
}

async function scrape(){
    let pages = 1;
    let n = 0;
    elipses = ""
    for(let i = 0; i < pages; i++){
        let page = `page=${i + 1}&`;
        let url = optionsLast.api + optionsLast.user + page + optionsLast.period + optionsLast.getTopTracks + optionsLast.limit + optionsLast.apiKey;
        let user_data = await fm_fetch(url);
        pages = user_data.toptracks["@attr"].totalPages
        let tracks = user_data.toptracks.track.length
        for (let j = 0; j < tracks; j++) {
            let o = new obj;
            o.scrobbles = user_data.toptracks.track[j].playcount;
            o.artist = user_data.toptracks.track[j].artist.name;
            o.title = user_data.toptracks.track[j].name;
            const regex = /\(| \[| ft| FT| Ft| FEAT| feat| Feat| Clean/;
            const artist = o.artist.split(regex)[0].replaceAll(" ", "+");
            const track = o.title.split(regex)[0].replaceAll(" ", "+");
            o.length = user_data.toptracks.track[j].duration;
            o.playtime = user_data.toptracks.track[j].duration * o.scrobbles;
            o.percent = perchance(optionsLast.period, o.length, 100)
            o.rankfm = (i) * 200 + j + 1

            let deezer_data = null;
            if(optionsThis.album_on && optionsThis.deezer_on){
                deezer_data = await deezer_fetch('https://deezerdevs-deezer.p.rapidapi.com/search?q=' + artist + "+" + track);
            }

            if(o.playtime == 0){
                if(optionsThis.deezer_on){
                    if(!deezer_data) deezer_data = await deezer_fetch('https://deezerdevs-deezer.p.rapidapi.com/search?q=' + artist + "+" + track);
                    try{
                        o.playtime = deezer_data.data[0].duration * o.scrobbles;
                    }catch{
                        maps.errors.push(`${o.title} - ${o.scrobbles}`);
                    }
                }else{
                    maps.errors.push(`${o.title} - ${o.scrobbles}`);
                }
            }

            if(optionsThis.genre_on || (optionsThis.album_on)) {
                optionsLast.artist = "artist=" + artist + "&";
                optionsLast.track = "track=" + track.split('.')[0].replaceAll(" ", "+") + "&";
                url = optionsLast.api + optionsLast.getInfo + optionsLast.artist + optionsLast.track + optionsLast.apiKey;
                try { 
                    const track_data = await fm_fetch(url); 

                    if(optionsThis.genre_on){
                        let genre = "";
                        for (let k = 0; k <  5; k++) {
                            try{ 
                                genre = track_data.track.toptags.tag[k].name;
                                o.genre = genre;
                                if (genre) {
                                    let gen_o = new obj;
                                    gen_o.genre = genre;
                                    let existing_object = maps.genres.get(genre)
                                    if(existing_object){
                                        gen_o.playtime = o.playtime + existing_object.playtime;
                                    }else{
                                        gen_o.playtime = o.playtime;
                                    }
                                    maps.genres.set(genre, gen_o)
                                }
                            }catch{ }
                        }
                    }
                    // console.log(maps.genres)

                    if(optionsThis.album_on){
                        let album = false;
                        if(!optionsThis.deezer_on){
                            try{ 
                                album = track_data.track.album.title
                            }catch{
                                //console.log(url)
                            }
                        }else if(optionsThis.deezer_on){
                            try{
                                album = deezer_data.data[0].album.title;
                            }catch{
                                //console.log("shit")
                            }
                        }

                        if(album){
                            o.album = album;
                            let alb_o = new album_obj;
                            alb_o.album = o.album;
                            alb_o.artist = o.artist
                            let existing_object = maps.albums.get(o.album)
                            if(existing_object){
                                alb_o.playtime = o.playtime + existing_object.playtime;
                            }else{
                                alb_o.playtime = o.playtime;
                            }
                            maps.albums.set(o.album, alb_o)
                        }
                        // console.log(maps.albums)
                    }
                }catch{
                    //console.log(url)
                }
            }


            if(optionsThis.artist_on) {
                let art_o = new artist_obj;
                art_o.artist = o.artist;
                let existing_object = maps.artists.get(o.artist)
                if(existing_object){
                    art_o.playtime = o.playtime + existing_object.playtime;
                }else{
                    art_o.playtime = o.playtime;
                }
                maps.artists.set(o.artist, art_o)
            }

            maps.tracks.set(o.title, o)
            if(optionsThis.stopped) break;

            n++
            console.log(n)
            let appendMin = 100
            if (optionsThis.artist_on || optionsThis.genre_on) appendMin = 10
            if (optionsThis.deezer_on) appendMin = 10
            if (optionsThis.deezer_on && (optionsThis.artist_on || optionsThis.genre_on)) appendMin = 3
            if (n % appendMin == 0) {
                elipses += ".";
                if (elipses.length > 3) {
                    elipses = "";
                }
                tbody.textContent = "Loading" + elipses;
            }
        }
        if(optionsThis.stopped) break;
    }

    mkarr(maps.tracks, arrays.tracks)
    if(optionsThis.artist_on) mkarr(maps.artists, arrays.artists)
    if(optionsThis.album_on) mkarr(maps.albums, arrays.albums)
    if(optionsThis.genre_on) mkarr(maps.genres, arrays.genres);

    console.log("Stopped!")
    
    document.getElementById("tracks").className = 'selected';
    clear();
	display("tracks");
}

function mkarr(map, array){
    map.forEach(e => {
        array.push(e);
    });
    array.sort((a, b) => b.playtime - a.playtime);
}

async function deezer_fetch(url){
    const res = await fetch(url, optionsDeezer)
    const data = await res.json()
    return data;
}

async function fm_fetch(url){
    const res = await fetch(url)
    const data = await res.json()
    return data;
}

function stop(){
    optionsThis.stopped = true;  
    console.log("Stopping...")
}