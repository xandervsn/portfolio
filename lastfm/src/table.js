const first_row = document.getElementById("first-row")
const table = document.getElementById("real");

first_row.onclick = () => {
	for (let i = 0; i < 4; i++) {
		first_row.children[i].className = "";
	}
	document.querySelectorAll( ":hover" )[7].className = "selected";
	clear();
	display(document.querySelectorAll(":hover")[7].id);
}

function display(input){
	let array = null;
	if(input == "tracks"){
		array = arrays.tracks;
	}else if(input == "artists"){
		array = arrays.artists;
	}else if(input == "albums"){
		array = arrays.albums;
	}else if(input == "genres"){
		array = arrays.genres	;
	}
	for (let i = 0; i < array.length; i++) {
		let newRow = table.insertRow(-1);

		let r_cell = newRow.insertCell();
		let rank = document.createElement('a');
		rank.innerHTML = `${i + 1}`
		r_cell.appendChild(rank)

		let t_cell = newRow.insertCell();
		let title = document.createElement('a');
		if(input == "tracks") title.innerHTML = `<b>${array[i].title}</b><br>${array[i].artist}`;
		if(input == "albums") title.innerHTML = `<b>${array[i].album}</b><br>${array[i].artist}`;
		if(input == "artists") title.innerHTML = `<b>${array[i].artist}</b>`;
		if(input == "genres") title.innerHTML = `<b>${array[i].genre}</b>`;
		t_cell.appendChild(title)

		let a_cell = newRow.insertCell();
		let artist = document.createElement('a');
		artist.innerHTML = `${anal(array[i].playtime)}`
		a_cell.appendChild(artist)
	}
}

function clear(){
	while(tbody.firstChild){
		tbody.removeChild(tbody.firstChild);
	}
}