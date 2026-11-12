const API_BASE = '/api/ranksum';
const AUTH_STORAGE_KEY = 'rankSumPassword';
const LIBRARY_STORAGE_KEY = 'rankSumLibrary';

let isAuthenticated = false;

function getStoredPassword() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) || '';
}

function setStoredPassword(password) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, password);
  isAuthenticated = true;
  updateAuthUi();
}

function clearStoredPassword() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  isAuthenticated = false;
  updateAuthUi();
}

function authHeaders(extra = {}) {
  const password = getStoredPassword();
  if (!password) return extra;
  return {
    ...extra,
    Authorization: `Bearer ${password}`,
  };
}

function withLibrary(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${API_BASE}${url}${sep}library=${encodeURIComponent(activeLibrary)}`;
}

function getAlbums(data) {
  return data.albums || [];
}

let activeLibrary =
  localStorage.getItem(LIBRARY_STORAGE_KEY) ||
  localStorage.getItem('musiLibrary') ||
  'movies';

function updateLibraryUi() {
  el.librarySelect.value = activeLibrary;
  const noun = activeLibrary === 'albums' ? 'albums' : 'movies';
  el.homeIntro.textContent = `Your ${noun}, ranked best to worst.`;
  document.title = activeLibrary === 'albums' ? 'RankSum — Albums' : 'RankSum — Movies';
}

function updateAuthUi() {
  const authed = Boolean(getStoredPassword());
  isAuthenticated = authed;
  el.btnAuthOpen.textContent = authed ? 'Sign out' : 'Sign in';
  el.btnAddOpen.hidden = !authed;
  el.btnReorderOpen.hidden = !authed;
  el.btnRecalcScores.hidden = !authed;
  renderHome();
  renderReadingView();
}

function openAuthModal() {
  el.authError.hidden = true;
  el.authPassword.value = '';
  el.authModal.hidden = false;
  el.authPassword.focus();
}

function closeAuthModal() {
  el.authModal.hidden = true;
}

async function verifyPassword(password) {
  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Invalid password');
  }
  return res.json();
}

/** Genres for an album (API-normalized array, or legacy single string). Unique, first-wins order. */
function albumGenresList(a) {
  let raw = [];
  if (Array.isArray(a.genres) && a.genres.length) {
    raw = a.genres.map((g) => String(g).trim()).filter(Boolean);
  } else if (a.genre != null && String(a.genre).trim()) {
    raw = String(a.genre)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const seen = new Set();
  return raw.filter((g) => {
    if (seen.has(g)) return false;
    seen.add(g);
    return true;
  });
}

function aggregateByArtist(albums) {
  const map = new Map();
  for (const a of albums) {
    const name = String(a.artist || '').trim() || '(Unknown)';
    if (!map.has(name)) map.set(name, { sum: 0, count: 0 });
    const g = map.get(name);
    g.sum += a.score;
    g.count += 1;
  }
  return [...map.entries()]
    .map(([name, { sum, count }]) => ({ name, count, avg: sum / count }))
    .sort((x, y) => y.avg - x.avg || x.name.localeCompare(y.name));
}

function aggregateByGenre(albums) {
  const map = new Map();
  for (const a of albums) {
    const list = albumGenresList(a);
    if (list.length === 0) {
      const name = 'Unspecified';
      if (!map.has(name)) map.set(name, { sum: 0, count: 0 });
      const g = map.get(name);
      g.sum += a.score;
      g.count += 1;
    } else {
      for (const raw of list) {
        const name = raw;
        if (!map.has(name)) map.set(name, { sum: 0, count: 0 });
        const g = map.get(name);
        g.sum += a.score;
        g.count += 1;
      }
    }
  }
  return [...map.entries()]
    .map(([name, { sum, count }]) => ({ name, count, avg: sum / count }))
    .sort((x, y) => y.avg - x.avg || x.name.localeCompare(y.name));
}

function buildStatsTable(rows) {
  const table = document.createElement('table');
  table.className = 'stats-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const label of ['Name', 'Albums', 'Avg']) {
    const th = document.createElement('th');
    th.textContent = label;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.textContent = row.name;
    const tdCount = document.createElement('td');
    tdCount.textContent = String(row.count);
    tdCount.className = 'stats-num';
    const tdAvg = document.createElement('td');
    tdAvg.textContent = row.avg.toFixed(2);
    tdAvg.className = 'stats-num';
    tr.appendChild(tdName);
    tr.appendChild(tdCount);
    tr.appendChild(tdAvg);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

let albumsData = null;
let pendingAlbum = null;
let versusState = null;

const el = {
  logoHome: document.getElementById('logo-home'),
  librarySelect: document.getElementById('library-select'),
  homeIntro: document.getElementById('home-intro'),
  navLibrary: document.getElementById('nav-library'),
  navAverages: document.getElementById('nav-averages'),
  navReading: document.getElementById('nav-reading'),
  btnAuthOpen: document.getElementById('btn-auth-open'),
  btnAddOpen: document.getElementById('btn-add-open'),
  btnReorderOpen: document.getElementById('btn-reorder-open'),
  btnRecalcScores: document.getElementById('btn-recalc-scores'),
  viewHome: document.getElementById('view-home'),
  viewAverages: document.getElementById('view-averages'),
  viewReading: document.getElementById('view-reading'),
  averagesIntro: document.getElementById('averages-intro'),
  statsArtists: document.getElementById('stats-artists'),
  statsGenres: document.getElementById('stats-genres'),
  statsArtistsMin2: document.getElementById('stats-artists-min2'),
  statsGenresMin2: document.getElementById('stats-genres-min2'),
  statsEmpty: document.getElementById('stats-empty'),
  viewAdd: document.getElementById('view-add'),
  viewEdit: document.getElementById('view-edit'),
  viewReorder: document.getElementById('view-reorder'),
  viewVersus: document.getElementById('view-versus'),
  reorderList: document.getElementById('reorder-list'),
  btnReorderCancel: document.getElementById('btn-reorder-cancel'),
  btnReorderDone: document.getElementById('btn-reorder-done'),
  albumList: document.getElementById('album-list'),
  emptyAll: document.getElementById('empty-all'),
  formAlbum: document.getElementById('form-album'),
  formEdit: document.getElementById('form-edit'),
  editContext: document.getElementById('edit-context'),
  editId: document.getElementById('edit-id'),
  editNotes: document.getElementById('edit-notes'),
  editFavorite: document.getElementById('edit-favorite'),
  editLeast: document.getElementById('edit-least'),
  editGenres: document.getElementById('edit-genres'),
  btnEditCancel: document.getElementById('btn-edit-cancel'),
  btnAddCancel: document.getElementById('btn-add-cancel'),
  versusNew: document.getElementById('versus-new'),
  versusExisting: document.getElementById('versus-existing'),
  versusNewTitle: document.getElementById('versus-new-title'),
  versusNewArtist: document.getElementById('versus-new-artist'),
  versusExistingTitle: document.getElementById('versus-existing-title'),
  versusExistingArtist: document.getElementById('versus-existing-artist'),
  versusProgress: document.getElementById('versus-progress'),
  toast: document.getElementById('toast'),
  authModal: document.getElementById('auth-modal'),
  authBackdrop: document.getElementById('auth-backdrop'),
  formAuth: document.getElementById('form-auth'),
  authPassword: document.getElementById('auth-password'),
  authError: document.getElementById('auth-error'),
  btnAuthCancel: document.getElementById('btn-auth-cancel'),
  readingPreviewCover: document.getElementById('reading-preview-cover'),
  readingPreviewAuthor: document.getElementById('reading-preview-author'),
  readingPreviewTitle: document.getElementById('reading-preview-title'),
  formReading: document.getElementById('form-reading'),
  readingTitleInput: document.getElementById('reading-title-input'),
  readingAuthorInput: document.getElementById('reading-author-input'),
  readingCoverInput: document.getElementById('reading-cover-input'),
  readingAuthNote: document.getElementById('reading-auth-note'),
  btnReadingSave: document.getElementById('btn-reading-save'),
};

let currentlyReadingData = null;

function readingCoverSrc(coverUrl, updatedAt) {
  if (!coverUrl) return '';
  if (!updatedAt) return coverUrl;
  const sep = coverUrl.includes('?') ? '&' : '?';
  return `${coverUrl}${sep}v=${encodeURIComponent(updatedAt)}`;
}

function renderReadingView() {
  if (!currentlyReadingData) return;

  const { title, author, coverUrl, updatedAt } = currentlyReadingData;
  el.readingPreviewAuthor.textContent = author;
  el.readingPreviewTitle.textContent = title;
  el.readingTitleInput.value = title;
  el.readingAuthorInput.value = author;
  el.readingCoverInput.value = '';

  if (coverUrl) {
    el.readingPreviewCover.src = readingCoverSrc(coverUrl, updatedAt);
    el.readingPreviewCover.alt = `${title} by ${author}`;
    el.readingPreviewCover.hidden = false;
  } else {
    el.readingPreviewCover.hidden = true;
  }

  const authed = isAuthenticated;
  el.readingAuthNote.hidden = authed;
  el.btnReadingSave.disabled = !authed;
  el.readingTitleInput.disabled = !authed;
  el.readingAuthorInput.disabled = !authed;
  el.readingCoverInput.disabled = !authed;
}

async function fetchCurrentlyReading() {
  const res = await fetch(`${API_BASE}/currently-reading`);
  if (!res.ok) throw new Error('Failed to load currently reading');
  currentlyReadingData = await res.json();
  renderReadingView();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read cover file'));
    reader.readAsDataURL(file);
  });
}

async function putCurrentlyReading(payload) {
  const res = await fetch(`${API_BASE}/currently-reading`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not save currently reading');
  }
  return res.json();
}

function splitCommaList(str) {
  if (!str || typeof str !== 'string') return [];
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.toast.hidden = true;
  }, 2800);
}

function showView(name) {
  el.viewHome.hidden = name !== 'home';
  el.viewAverages.hidden = name !== 'averages';
  el.viewReading.hidden = name !== 'reading';
  el.viewAdd.hidden = name !== 'add';
  el.viewEdit.hidden = name !== 'edit';
  el.viewReorder.hidden = name !== 'reorder';
  el.viewVersus.hidden = name !== 'versus';
  el.btnAddOpen.hidden = name !== 'home' && name !== 'averages' || !isAuthenticated;
  el.btnReorderOpen.hidden = name !== 'home' || !isAuthenticated;
  el.btnRecalcScores.hidden = name !== 'home' || !isAuthenticated;
  const libraryStack =
    name === 'home' || name === 'add' || name === 'edit' || name === 'reorder' || name === 'versus';
  el.navLibrary.classList.toggle('is-active', libraryStack);
  el.navAverages.classList.toggle('is-active', name === 'averages');
  el.navReading.classList.toggle('is-active', name === 'reading');
  el.librarySelect.closest('.library-picker').hidden = name === 'reading';
}

function openEdit(album) {
  if (!isAuthenticated) {
    openAuthModal();
    return;
  }
  el.editId.value = album.id;
  el.editContext.textContent = `${album.title} · ${album.artist} · ${album.score.toFixed(2)}`;
  el.editGenres.value = albumGenresList(album).join(', ');
  el.editNotes.value = album.notes != null ? String(album.notes) : '';
  el.editFavorite.value = (album.favoriteSongs || []).join(', ');
  el.editLeast.value = (album.leastFavoriteSongs || []).join(', ');
  showView('edit');
}

async function fetchAlbums() {
  const res = await fetch(withLibrary('/albums'));
  if (!res.ok) throw new Error('Failed to load albums');
  albumsData = await res.json();
  renderHome();
  renderAverages();
}

function renderAverages() {
  if (!albumsData) return;
  const albums = getAlbums(albumsData);
  const total = albums.length;
  el.statsEmpty.hidden = total > 0;
  el.averagesIntro.hidden = total === 0;
  document.querySelectorAll('#view-averages .stats-section').forEach((s) => {
    s.hidden = total === 0;
  });
  if (total === 0) {
    el.statsArtists.innerHTML = '';
    el.statsGenres.innerHTML = '';
    return;
  }
  el.statsArtists.innerHTML = '';
  el.statsGenres.innerHTML = '';

  const artistsRows = aggregateByArtist(albums);
  const genresRows = aggregateByGenre(albums);
  const minArtists = el.statsArtistsMin2.checked;
  const minGenres = el.statsGenresMin2.checked;

  el.statsArtists.appendChild(
    buildStatsBlock(artistsRows, minArtists, 'No artists with at least 2 albums.')
  );
  el.statsGenres.appendChild(
    buildStatsBlock(genresRows, minGenres, 'No genres with at least 2 albums.')
  );
}

function buildStatsBlock(rows, min2, emptyMin2Message) {
  const filtered = min2 ? rows.filter((r) => r.count >= 2) : rows;
  if (filtered.length === 0) {
    const p = document.createElement('p');
    p.className = 'stats-filtered-empty muted';
    p.textContent = min2 ? emptyMin2Message : 'No data.';
    return p;
  }
  return buildStatsTable(filtered);
}

function renderHome() {
  if (!albumsData) return;

  const list = getAlbums(albumsData);
  el.albumList.innerHTML = '';

  if (list.length === 0) {
    el.emptyAll.hidden = false;
    el.btnReorderOpen.disabled = true;
    el.btnRecalcScores.disabled = true;
    return;
  }

  for (const a of list) {
    el.albumList.appendChild(renderAlbumRow(a));
  }

  el.emptyAll.hidden = true;
  el.btnReorderOpen.disabled = !isAuthenticated;
  el.btnRecalcScores.disabled = !isAuthenticated;
}

function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.reorder-item:not(.reorder-dragging)')];
  return items.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function attachReorderList(ul) {
  let dragged = null;

  ul.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.reorder-item');
    if (!item || !ul.contains(item)) return;
    dragged = item;
    item.classList.add('reorder-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });

  ul.addEventListener('dragend', (e) => {
    const item = e.target.closest('.reorder-item');
    if (item) item.classList.remove('reorder-dragging');
    dragged = null;
  });

  ul.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!dragged || !ul.contains(dragged)) return;
    e.dataTransfer.dropEffect = 'move';
    const after = getDragAfterElement(ul, e.clientY);
    if (after == null) {
      ul.appendChild(dragged);
    } else {
      ul.insertBefore(dragged, after);
    }
  });
}

function renderReorderPanel() {
  el.reorderList.innerHTML = '';
  if (!albumsData) return;

  const list = getAlbums(albumsData);
  for (const a of list) {
    const li = document.createElement('li');
    li.className = 'reorder-item';
    li.draggable = true;
    li.dataset.id = a.id;
    li.textContent = a.title;
    el.reorderList.appendChild(li);
  }
}

function collectReorderPayload() {
  return {
    ids: [...el.reorderList.querySelectorAll('.reorder-item')].map((li) => li.dataset.id),
  };
}

async function putAlbumOrder(payload) {
  const res = await fetch(withLibrary('/albums/order'), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not save order');
  }
  return res.json();
}

async function postRecalculateScores() {
  const res = await fetch(withLibrary('/albums/recalculate-scores'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not recalculate scores');
  }
  return res.json();
}

function renderAlbumRow(a) {
  const li = document.createElement('li');
  li.className = 'album-row';

  const main = document.createElement('div');
  main.className = 'album-main';
  const titleEl = document.createElement('p');
  titleEl.className = 'album-title';
  titleEl.textContent = a.title;
  const artistEl = document.createElement('p');
  artistEl.className = 'album-artist';
  artistEl.textContent = a.artist;
  main.appendChild(titleEl);
  main.appendChild(artistEl);
  const genresStr = albumGenresList(a);
  if (genresStr.length) {
    const genreEl = document.createElement('p');
    genreEl.className = 'album-genre';
    genreEl.textContent = genresStr.join(', ');
    main.appendChild(genreEl);
  }

  const side = document.createElement('div');
  side.className = 'album-side';
  const scoreEl = document.createElement('div');
  scoreEl.className = 'album-score';
  scoreEl.textContent = a.score.toFixed(2);
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn-link';
  editBtn.textContent = 'Edit details';
  editBtn.hidden = !isAuthenticated;
  editBtn.addEventListener('click', () => openEdit(a));
  side.appendChild(scoreEl);
  side.appendChild(editBtn);

  li.appendChild(main);
  li.appendChild(side);

  const notes = a.notes && String(a.notes).trim();
  const fav = a.favoriteSongs && a.favoriteSongs.length
    ? `Favorites: ${a.favoriteSongs.join(', ')}`
    : null;
  const least = a.leastFavoriteSongs && a.leastFavoriteSongs.length
    ? `Least favorite: ${a.leastFavoriteSongs.join(', ')}`
    : null;

  const parts = [];
  if (notes) {
    const p = document.createElement('p');
    p.textContent = notes;
    parts.push(p);
  }
  if (fav || least) {
    const ul = document.createElement('ul');
    ul.className = 'album-songs';
    if (fav) {
      const liF = document.createElement('li');
      liF.textContent = fav;
      ul.appendChild(liF);
    }
    if (least) {
      const liL = document.createElement('li');
      liL.textContent = least;
      ul.appendChild(liL);
    }
    parts.push(ul);
  }
  if (parts.length) {
    const meta = document.createElement('div');
    meta.className = 'album-meta';
    for (const node of parts) meta.appendChild(node);
    li.appendChild(meta);
  }

  return li;
}

function binarySearchInsertIndex(albums, askCompare) {
  if (!albums.length) {
    return Promise.resolve(0);
  }

  let low = 0;
  let high = albums.length - 1;
  let step = 0;

  return new Promise(function proceed(resolve) {
    function next() {
      if (low > high) {
        resolve(low);
        return;
      }
      const mid = Math.floor((low + high) / 2);
      step += 1;
      el.versusProgress.textContent = `Comparison ${step} — pick the better album.`;
      askCompare(mid).then((newIsBetter) => {
        if (newIsBetter) {
          high = mid - 1;
        } else {
          low = mid + 1;
        }
        next();
      });
    }
    next();
  });
}

function askWhichIsBetter(mid) {
  return new Promise((resolve) => {
    const list = versusState.albums;
    const existing = list[mid];
    el.versusNewTitle.textContent = pendingAlbum.title;
    el.versusNewArtist.textContent = pendingAlbum.artist;
    el.versusExistingTitle.textContent = existing.title;
    el.versusExistingArtist.textContent = existing.artist;

    const onNew = () => {
      cleanup();
      resolve(true);
    };
    const onExisting = () => {
      cleanup();
      resolve(false);
    };
    function cleanup() {
      el.versusNew.removeEventListener('click', onNew);
      el.versusExisting.removeEventListener('click', onExisting);
    }

    el.versusNew.addEventListener('click', onNew, { once: true });
    el.versusExisting.addEventListener('click', onExisting, { once: true });
  });
}

async function postAlbum(payload) {
  const res = await fetch(withLibrary('/albums'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not save album');
  }
  return res.json();
}

async function patchAlbum(id, payload) {
  const res = await fetch(withLibrary(`/albums/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not save details');
  }
  return res.json();
}

el.logoHome.addEventListener('click', () => {
  showView('home');
});

el.navLibrary.addEventListener('click', () => {
  showView('home');
});

el.navAverages.addEventListener('click', () => {
  showView('averages');
});

el.navReading.addEventListener('click', () => {
  showView('reading');
});

el.btnAuthOpen.addEventListener('click', () => {
  if (isAuthenticated) {
    clearStoredPassword();
    showToast('Signed out.');
    showView('home');
    return;
  }
  openAuthModal();
});

el.btnAuthCancel.addEventListener('click', closeAuthModal);
el.authBackdrop.addEventListener('click', closeAuthModal);

el.formAuth.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = String(el.authPassword.value || '');
  el.authError.hidden = true;
  try {
    await verifyPassword(password);
    setStoredPassword(password);
    closeAuthModal();
    showToast('Signed in.');
    await fetchAlbums();
  } catch (err) {
    el.authError.textContent = err.message || 'Sign in failed';
    el.authError.hidden = false;
  }
});

el.librarySelect.addEventListener('change', async () => {
  activeLibrary = el.librarySelect.value;
  localStorage.setItem(LIBRARY_STORAGE_KEY, activeLibrary);
  updateLibraryUi();
  try {
    await fetchAlbums();
    showView('home');
    showToast(`Switched to ${activeLibrary}.`);
  } catch {
    showToast('Could not load library.');
  }
});

el.statsArtistsMin2.addEventListener('change', () => renderAverages());
el.statsGenresMin2.addEventListener('change', () => renderAverages());

el.btnAddOpen.addEventListener('click', () => {
  pendingAlbum = null;
  el.formAlbum.reset();
  showView('add');
});

el.btnReorderOpen.addEventListener('click', () => {
  renderReorderPanel();
  showView('reorder');
});

el.btnRecalcScores.addEventListener('click', async () => {
  try {
    await postRecalculateScores();
    await fetchAlbums();
    showToast('Scores recalculated.');
  } catch (err) {
    showToast(err.message || 'Recalculate failed');
  }
});

el.btnReorderCancel.addEventListener('click', () => {
  showView('home');
});

el.btnReorderDone.addEventListener('click', async () => {
  try {
    await putAlbumOrder(collectReorderPayload());
    await fetchAlbums();
    showToast('Order saved.');
    showView('home');
  } catch (err) {
    showToast(err.message || 'Save failed');
  }
});

el.btnAddCancel.addEventListener('click', () => {
  showView('home');
});

el.btnEditCancel.addEventListener('click', () => {
  showView('home');
});

el.formEdit.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(el.formEdit);
  const id = fd.get('id');
  if (!id) return;

  try {
    await patchAlbum(id, {
      genres: splitCommaList(fd.get('genres')),
      notes: String(fd.get('notes') || ''),
      favoriteSongs: splitCommaList(fd.get('favoriteSongs')),
      leastFavoriteSongs: splitCommaList(fd.get('leastFavoriteSongs')),
    });
    await fetchAlbums();
    showToast('Details saved.');
    showView('home');
  } catch (err) {
    showToast(err.message || 'Save failed');
  }
});

el.formReading.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isAuthenticated) {
    openAuthModal();
    return;
  }

  const title = String(el.readingTitleInput.value || '').trim();
  const author = String(el.readingAuthorInput.value || '').trim();
  const coverFile = el.readingCoverInput.files?.[0];

  const payload = { title, author };
  if (coverFile) {
    if (coverFile.type !== 'image/png') {
      showToast('Cover must be a PNG image.');
      return;
    }
    try {
      payload.coverBase64 = await readFileAsDataUrl(coverFile);
    } catch (err) {
      showToast(err.message || 'Could not read cover file.');
      return;
    }
  }

  try {
    currentlyReadingData = await putCurrentlyReading(payload);
    renderReadingView();
    showToast('Portfolio reading updated.');
  } catch (err) {
    showToast(err.message || 'Save failed');
  }
});

el.formAlbum.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(el.formAlbum);

  pendingAlbum = {
    title: String(fd.get('title') || '').trim(),
    artist: String(fd.get('artist') || '').trim(),
    genres: splitCommaList(fd.get('genres')),
    notes: String(fd.get('notes') || ''),
    favoriteSongs: splitCommaList(fd.get('favoriteSongs')),
    leastFavoriteSongs: splitCommaList(fd.get('leastFavoriteSongs')),
  };

  await fetchAlbums();
  const library = getAlbums(albumsData);

  if (library.length === 0) {
    try {
      await postAlbum({
        ...pendingAlbum,
        insertIndex: 0,
      });
      await fetchAlbums();
      showToast('Album saved.');
      showView('home');
    } catch (err) {
      showToast(err.message || 'Save failed');
    }
    return;
  }

  versusState = { albums: library };
  el.versusProgress.textContent = '';
  showView('versus');

  try {
    const insertIndex = await binarySearchInsertIndex(library, askWhichIsBetter);
    await postAlbum({
      ...pendingAlbum,
      insertIndex,
    });
    await fetchAlbums();
    showToast('Album saved.');
    showView('home');
  } catch (err) {
    showToast(err.message || 'Save failed');
    showView('home');
  } finally {
    versusState = null;
    pendingAlbum = null;
  }
});

fetchAlbums()
  .then(() => fetchCurrentlyReading())
  .then(() => {
    updateLibraryUi();
    updateAuthUi();
    attachReorderList(el.reorderList);
    showView('home');
  })
  .catch(() => {
    showToast('Could not load library.');
  });
