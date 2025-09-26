import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Firestore 인스턴스
const db = getFirestore();

// 사용자 ID 지정 (친구 전용 사이트니까 고정값 사용)
const myUserId = 'friend1';  // 👈 친구에게는 이걸로 고정

// 좋아요 저장 함수
async function saveFavoriteSongs(userId, favoriteSongs) {
  try {
    await setDoc(doc(db, "users", userId), {
      favoriteSongs: favoriteSongs
    });
    console.log(`[Firebase] 저장 완료 (${userId}):`, favoriteSongs);
  } catch (error) {
    console.error("Firebase 저장 오류:", error);
  }
}

let musicList = [];
let currentMusic = null;
let currentAudio = null;
let isShuffle = false;
let repeatMode = 0;

function renderFavoriteList() {
    const ul = document.getElementById('favoriteSongList');
    ul.innerHTML = '';

    const favorites = musicList.filter(m => favoriteSongs.includes(String(m.id)));

    if (favorites.length === 0) {
        ul.innerHTML = '<p style="padding:20px; text-align:center;">즐겨찾기한 곡이 없습니다.</p>';
        return;
    }

    favorites.forEach(music => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${music.imgsrc}">
            <div class="listType">
                <p class="listTitle">${music.name}</p>
                <p class="listArtist">${music.singer}</p>
            </div>
        `;
        li.onclick = () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            currentMusic = music;
            currentMusic.startPlayMusic();
            favoriteList.classList.remove('active');
        };
        ul.appendChild(li);
    });
}

let lyricOffset = 0.2;

function detectEnvironmentAndSetOffset() {
    const ua = navigator.userAgent.toLowerCase();

    if (/samsungbrowser/.test(ua)) {
        lyricOffset = 0.6;
    } else if (/iphone|ipad|ipod/.test(ua)) {
        lyricOffset = 0.1;
    } else if (/android/.test(ua)) {
        lyricOffset = 0.5;
    } else {
        lyricOffset = 0.2;
    }
}

class DoubleLinkedList {
    constructor(name) {
        this.name = name;
        this._plink = null;
        this._nlink = null;
    }
    get pLink() { return this._plink; }
    set pLink(v) { this._plink = v; }
    get nLink() { return this._nlink; }
    set nLink(v) { this._nlink = v; }
}

class musicPlayer extends DoubleLinkedList {
    constructor(id, singer, name, src, imgsrc) {
        super(name);
        this.id = id;
        this.singer = singer;
        this.src = src;
        this.imgsrc = imgsrc;
        this.lyrics = [];
        this.currentLyricIndex = 0;
    }

    displaySinger() {
        lyricstitleName.innerText = this.name;
        lyricsartistName.innerText = this.singer;
        const titleNameEl = document.getElementById('titleName');
        const artistNameEl = document.getElementById('artistName');
        if (titleNameEl) titleNameEl.innerText = this.name;
        if (artistNameEl) artistNameEl.innerText = this.singer;
    }

    displayItem() {
        coverImg.innerHTML = `<img src="${this.imgsrc}" style="width:100%; cursor:pointer;" id="albumCover">`;
        document.getElementById('albumCover').onclick = () => {
            this.displaySinger();
            this.displayAllLyrics();
            lyricsOverlay.style.display = 'block';
        };
    }

    async loadLyrics() {
        try {
            const res = await fetch(`./lyrics/${this.id}.json`);
            if (!res.ok) throw new Error('Lyrics not found');
            this.lyrics = (await res.json()).filter(line => typeof line.time === 'number' && typeof line.text === 'string');
        } catch (err) {
            console.error("가사 로드 실패:", err);
            this.lyrics = [];
        }
    }

    displayAllLyrics() {
        lyricsBox.innerHTML = '';
        if (!this.lyrics.length) {
            lyricsBox.innerHTML = '<p>가사가 없습니다.</p>';
            return;
        }
        this.lyrics.forEach(line => {
            const p = document.createElement('p');
            p.dataset.time = line.time;
            p.innerText = line.text;
            lyricsBox.appendChild(p);
        });
    }

    updateLyricsAtTime(time) {
        if (!this.lyrics.length) return;
        time += lyricOffset;

        let idx = 0;
        for (let i = 0; i < this.lyrics.length; i++) {
            if (this.lyrics[i].time <= time) idx = i;
            else break;
        }
        this.currentLyricIndex = idx;

        // 기존 가사 하이라이트 및 스크롤 처리 코드 유지
        document.querySelectorAll('#lyricsBox p').forEach(p => p.classList.remove('activeLyric'));
        const activeP = document.querySelector(`#lyricsBox p[data-time="${this.lyrics[idx].time}"]`);
        if (activeP) {
            activeP.classList.add('activeLyric');
            let targetScroll = activeP.offsetTop - lyricsBox.clientHeight / 2 + activeP.clientHeight / 2;
            targetScroll = Math.min(targetScroll, lyricsBox.scrollHeight - lyricsBox.clientHeight);
            targetScroll = Math.max(targetScroll, 0);
            lyricsBox.scrollTop = targetScroll;
        }

        const lyricsAreaEl = document.getElementById('lyricsArea');
        if (lyricsAreaEl) lyricsAreaEl.innerText = this.lyrics[idx].text;
    }

    setupLyricSync() {
        if (!currentAudio) return;

        // 이전에 등록한 이벤트 핸들러 제거 (중복 등록 방지)
        if (this._timeupdateHandler) {
            currentAudio.removeEventListener('timeupdate', this._timeupdateHandler);
        }

        // 새로운 핸들러 등록
        this._timeupdateHandler = () => {
            this.updateLyricsAtTime(currentAudio.currentTime);
        };

        currentAudio.addEventListener('timeupdate', this._timeupdateHandler);
    }


    updateTimeDisplay() {
        playTime.innerText = this.formatTime(Math.floor(currentAudio.currentTime));
        fullTime.innerText = this.formatTime(Math.floor(currentAudio.duration || 0));
        audioRange.value = currentAudio.duration ? (currentAudio.currentTime / currentAudio.duration) * 100 : 0;
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    musicPlayItem() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        playArea.innerHTML = `<audio src="${this.src}" id="${this.id}" autoplay></audio>`;
        currentAudio = document.getElementById(this.id);

        currentAudio.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
        currentAudio.addEventListener('timeupdate', () => this.updateTimeDisplay());

        currentAudio.addEventListener('ended', () => {
            if (repeatMode === 1) {
                currentAudio.currentTime = 0;
                this.currentLyricIndex = 0;
                this.updateLyricsAtTime(0);
                currentAudio.play();
            } else if (isShuffle) {
                let next;
                do { next = musicList[Math.floor(Math.random() * musicList.length)]; }
                while (next === this);
                currentMusic = next;
                currentMusic.startPlayMusic();
            } else {
                currentMusic = this.nLink;
                currentMusic.startPlayMusic();
            }
        });

        audioRange.addEventListener('input', (e) => {
            currentAudio.currentTime = (currentAudio.duration * e.target.value) / 100;
            this.updateLyricsAtTime(currentAudio.currentTime);
        });
    }

    async startPlayMusic() {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'block';
        this.displaySinger();
        this.displayItem();
        await this.loadLyrics();
        this.displayAllLyrics();
        this.musicPlayItem();
        this.setupLyricSync();
        this.updateActiveSongHighlight();
    }

    updateActiveSongHighlight() {
        document.querySelectorAll("#listArea li").forEach(li => li.classList.remove("activeSong"));
        const index = musicList.indexOf(this);
        const li = document.querySelectorAll("#listArea li")[index];
        if (li) li.classList.add("activeSong");
    }

    prepareMusicUI() {
        this.displaySinger();
        this.displayItem();
        this.clickSong();
    }

    clickSong() {
        document.querySelectorAll("#listArea li").forEach((li, idx) => {
            li.onclick = () => {
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }
                currentMusic = musicList[idx];
                currentMusic.prepareMusicUI();
                currentMusic.startPlayMusic();
                playList.classList.remove("active");
            };
        });
    }
}

async function loadSongs() {
    const res = await fetch('./songs.json');
    const data = await res.json();
    musicList = data.map(song => new musicPlayer(song.id, song.singer, song.name, song.src, song.imgsrc));

    musicList.forEach((m, i) => {
        m.pLink = musicList[(i - 1 + musicList.length) % musicList.length];
        m.nLink = musicList[(i + 1) % musicList.length];
    });

    currentMusic = musicList[0];
}

const playList = document.getElementById('playList');

function renderSongList() {
    const ul = document.getElementById('songList');
    ul.innerHTML = '';

    musicList.forEach((music, index) => {
        const li = document.createElement('li');
        li.dataset.index = index + 1;
        li.innerHTML = `
            <img src="${music.imgsrc}">
            <div class="listType">
                <p class="listTitle">${music.name}</p>
                <p class="listArtist">${music.singer}</p>
            </div>
            <i class="fa-${favoriteSongs.includes(music.id) ? 'solid' : 'regular'} fa-heart fav-icon" data-id="${music.id}" style="margin-left:auto; padding-right:15px; cursor:pointer;"></i>
        `;

        li.onclick = () => {
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.currentTime = 0;
            }
            currentMusic = music;
            currentMusic.startPlayMusic();
            playList.classList.remove("active");
        };

        li.querySelector('.fav-icon').addEventListener('click', (e) => {
            e.stopPropagation(); // 곡 재생 이벤트 막기
            const songId = e.currentTarget.dataset.id;

            if (favoriteSongs.includes(songId)) {
                favoriteSongs = favoriteSongs.filter(id => id !== songId);
            } else {
                favoriteSongs.push(songId);
            }

            localStorage.setItem('favoriteSongs', JSON.stringify(favoriteSongs));

            // 🔥 Firebase에 저장하기
            saveFavoriteSongs(myUserId, favoriteSongs);
            
            renderSongList();       // 전체 목록 갱신
            renderFavoriteList();   // 즐겨찾기 목록 갱신
        });

        const star = li.querySelector('.fav-icon');
        if (favoriteSongs.includes(music.id)) {
            star.classList.add('active');
        }

        ul.appendChild(li);
    });
}

window.addEventListener('load', async () => {
    detectEnvironmentAndSetOffset();

    setVH();
    await loadSongs();
    renderSongList();

    currentMusic.prepareMusicUI();
    playBtn.style.display = 'block';
    pauseBtn.style.display = 'none';

    await currentMusic.loadLyrics();
    currentMusic.displayAllLyrics();
    lyricsArea.innerText = currentMusic.lyrics.length ? currentMusic.lyrics[0].text : '가사가 없습니다.';
});

function updateButtonColors() {
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
    const isNight = document.body.classList.contains('night');

    if (isShuffle) {
        ranBtn.style.color = isNight ? themeColor : themeColor;
    } else {
        ranBtn.style.color = isNight ? '#fff' : '#000';
    }

    if (repeatMode) {
        repeatBtn.style.color = isNight ? themeColor : themeColor;
    } else {
        repeatBtn.style.color = isNight ? '#fff' : '#000';
    }
}

playBtn.onclick = () => currentAudio ? (currentAudio.play(), playBtn.style.display = 'none', pauseBtn.style.display = 'block') : currentMusic.startPlayMusic();
pauseBtn.onclick = () => currentAudio && (currentAudio.pause(), playBtn.style.display = 'block', pauseBtn.style.display = 'none');
nextBtn.onclick = () => { currentMusic = isShuffle ? musicList[Math.floor(Math.random() * musicList.length)] : currentMusic.nLink; currentMusic.startPlayMusic(); };
prevBtn.onclick = () => { currentMusic = currentMusic.pLink; currentMusic.startPlayMusic(); };
ranBtn.onclick = () => {
    isShuffle = !isShuffle;
    localStorage.setItem('isShuffle', isShuffle);
    updateButtonColors();
};

repeatBtn.onclick = () => {
    repeatMode = (repeatMode + 1) % 2;
    localStorage.setItem('repeatMode', repeatMode);
    updateButtonColors();
};
underBtn.onclick = () => {
    playList.classList.add("active");
    favoriteList.classList.remove("active");
};
backBtn.onclick = () => playList.classList.remove("active");
closeOverlay.onclick = () => lyricsOverlay.style.display = 'none';
lyricsBox.onclick = () => lyricsOverlay.style.display = 'none';

function setVH() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', setVH);
window.addEventListener('load', setVH);
window.addEventListener('orientationchange', setVH);


document.getElementById('dayBtn').onclick = () => {
    document.body.classList.add('night');
    document.documentElement.classList.add('night');
    localStorage.setItem('themeMode', 'night');  // night 모드 저장
    updateButtonColors();
};

document.getElementById('nightBtn').onclick = () => {
    document.body.classList.remove('night');
    document.documentElement.classList.remove('night');
    localStorage.setItem('themeMode', 'day');    // day 모드 저장
    updateButtonColors();
};

const themePopup = document.getElementById('themePopup');
const root = document.documentElement;

// 테마 버튼 이벤트
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        const color = e.target.dataset.color;
        document.documentElement.style.setProperty('--theme-color', color);
        localStorage.setItem('themeColor', color);
        themePopup.classList.add('hidden');
        updateButtonColors();  // 색상도 즉시 반영
    });
});

// 톱니바퀴 버튼으로 팝업 열기 (톱니바퀴 버튼 id="gearIcon" 가정)
document.getElementById('gearIcon').addEventListener('click', (e) => {
    e.stopPropagation(); // 이걸로 document click까지 전달되지 않게
    const popup = document.getElementById('themePopup');
    popup.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    const popup = document.getElementById('themePopup');
    if (!popup.classList.contains('hidden') && !popup.contains(e.target)) {
        popup.classList.add('hidden');
    }
});

// 페이지 로드시 저장된 테마 색상 적용
window.addEventListener('load', () => {
    const savedColor = localStorage.getItem('themeColor');
    if (savedColor) {
        root.style.setProperty('--theme-color', savedColor);
    }

    const savedMode = localStorage.getItem('themeMode');
    if (savedMode === 'night') {
        document.body.classList.add('night');
        document.documentElement.classList.add('night');
    }

    isShuffle = localStorage.getItem('isShuffle') === 'true';
    repeatMode = parseInt(localStorage.getItem('repeatMode')) || 0;

    updateButtonColors();
});

if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('night');
    document.documentElement.classList.add('night');
}

const lyricsOverlay = document.getElementById('lyricsOverlay');
const albumCover = document.getElementById('albumCover');
const lyricBox = document.getElementById('lyricsBox');

document.getElementById('albumCover').addEventListener('click', () => {
    // 가사창 열기
    lyricsOverlay.style.display = 'block';
    // 앨범커버 확대 + 블러
    document.getElementById('albumCover').classList.add('zoomed-behind');
});

document.getElementById('closeOverlay').addEventListener('click', () => {
    // 가사창 닫기
    lyricsOverlay.style.display = 'none';
    // 앨범커버 원복
    document.getElementById('albumCover').classList.remove('zoomed-behind');
});

lyricsOverlay.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        albumCover.classList.remove('zoomed-behind');
        lyricsOverlay.style.display = 'none';
    }
});

// lyricsBox 클릭 시도 앨범 커버 줌 해제 + 오버레이 닫기
lyricBox.addEventListener('click', () => {
    albumCover.classList.remove('zoomed-behind');
    lyricsOverlay.style.display = 'none';
});

window.addEventListener('keydown', (e) => {
    // 입력 요소에 포커스되어 있을 때는 무시 (ex. input, textarea)
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

    if (e.code === 'Space') {
        e.preventDefault(); // 스크롤 방지
        if (!currentAudio) return;
        if (currentAudio.paused) {
            currentAudio.play();
            playBtn.style.display = 'none';
            pauseBtn.style.display = 'block';
        } else {
            currentAudio.pause();
            playBtn.style.display = 'block';
            pauseBtn.style.display = 'none';
        }
    }
});

const favoriteList = document.getElementById('favoriteList');
const openFavoriteBtn = document.getElementById('openFavoriteBtn');

openFavoriteBtn.addEventListener('click', () => {
    renderFavoriteList();
    favoriteList.classList.add('active');
    playList.classList.remove("active");
    const popup = document.getElementById('themePopup');
    popup.classList.add('hidden');
});

const favBackBtn = document.getElementById('favBackBtn');

favBackBtn.addEventListener('click', () => {
    favoriteList.classList.remove('active');
});

let favoriteSongs = JSON.parse(localStorage.getItem('favoriteSongs')) || [];

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        favoriteList.classList.remove('active');
        playList.classList.remove('active');
    }
});
