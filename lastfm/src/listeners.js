const stopBtn = document.getElementById("stop")
const errorList = document.getElementById('errorList')
const content = document.getElementById('content')
const artist = document.getElementById("artist")
const album = document.getElementById("album")
const genre = document.getElementById("genre")
const deezer = document.getElementById("deezer")
const tbody = document.getElementById('tbody');

const go = document.getElementById("button");
const input = document.getElementById("input")


go.onclick = () => {
    init("user=" + input.value + "&", artist.checked, album.checked, genre.checked, deezer.checked)
    clear();
    tbody.textContent = "Loading";
	arrays.artists = [];
	arrays.tracks = [];
	arrays.albums = [];
	arrays.genres = [];
}

stopBtn.onclick = () => {
    console.log("Stopping...")
    optionsThis.stopped = true;
}
