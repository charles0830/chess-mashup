
window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const mainGain = audioCtx.createGain();
mainGain.connect(audioCtx.destination);

let muted = false;

const playSound = (soundName, { playbackRate = 1, playbackRateVariation = 0, volume = 1, looping = false, time = 0, destination = audioCtx.destination } = {}) => {
	const audioBuffer = resources[soundName];
	if (!audioBuffer) {
		console.warn(`No AudioBuffer loaded for sound '${soundName}'`);
		return Promise.resolve();
	}
	const gain = audioCtx.createGain();
	gain.gain.value = volume;
	gain.connect(destination);
	const source = audioCtx.createBufferSource();
	source.buffer = audioBuffer;
	source.loop = looping;
	source.connect(gain);
	source.start(time);
	source.playbackRate.value = playbackRate + (Math.random() * playbackRateVariation);
	const promise = new Promise((resolve) => source.onended = resolve);
	promise.bufferSource = source;
	return promise;
};

const loadSound = async (path) => {
	const response = await fetch(path);
	if (response.ok) {
		return await audioCtx.decodeAudioData(await response.arrayBuffer());
	} else {
		throw new Error(`got HTTP ${response.status} fetching '${path}'`);
	}
};

const loadResource = (path) => {
	if (path.match(/\.(ogg|mp3|wav)$/i)) {
		return loadSound(path);
	}
	throw new Error(`How should I load this? '${path}'`);
};

const resourcePaths = {
	// "check": "sounds/check.wav",
	// "checkmate": "sounds/checkmate.wav",
	"lift-piece": "sounds/slide-whistle-up.wav",
	// "piece-hit-board": "sounds/click.wav",
	// "take-move": "sounds/slide-whistle-up-short.wav",
	"take-move": "sounds/cartoon-take-move.wav",
	"moving-loop": "sounds/cartoon-scamper-loop.wav",
	"cancel-move": "sounds/slide-whistle-down.wav",
	// "cancel-move-in-progress": "sounds/cancel-move-in-progress.wav",
	// "speed-move-in-progress": "sounds/speed-move-in-progress.wav",
	// "invalid-move": "sounds/invalid-move.wav",
	// "reveal-attacking-path": "sounds/reveal-attacking-path.wav",
	// "capture": "sounds/capture.wav",
	// "win": "sounds/win.wav",
	// "lose": "sounds/lose.wav",
	// "draw": "sounds/draw.wav",
	// "undo": "sounds/undo.wav",
	// "redo": "sounds/redo.wav",
};

const totalResources = Object.keys(resourcePaths).length;
let loadedResources = 0;
const progressBar = document.getElementById("loading-progress");
const loadResources = async (resourcePathsByID) => {
	const entries = Object.entries(resourcePathsByID);
	return Object.fromEntries(await Promise.all(entries.map(async ([id, path]) => {
		let resource;
		// try {
			resource = await loadResource(path);
		// } catch (error) {
		// 	showErrorMessage(`Failed to load resource '${path}'`, error);
		// }
		loadedResources += 1;
		progressBar.value = loadedResources / totalResources;
		return [id, resource];
	})));
};
let resources;
(async () => {
	resources = await loadResources(resourcePaths);
})();

window.playSound = playSound;
