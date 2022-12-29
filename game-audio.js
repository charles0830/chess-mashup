
const AudioContext = window.AudioContext || window.webkitAudioContext;

export const audioCtx = new AudioContext();
export const mainGain = audioCtx.createGain();
mainGain.connect(audioCtx.destination);

export let muted = false;

export const playSound = (soundName, { playbackRate = 1, playbackRateVariation = 0, volume = 1, looping = false, time = 0, destination = audioCtx.destination } = {}) => {
	const audioBuffer = resources?.[soundName];
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
	audioCtx.resume();
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
	"check": "sounds/cartoon-check.wav",
	"lift-piece": "sounds/slide-whistle-up.wav",
	// "piece-hit-board": "sounds/click.wav",
	// "take-move": "sounds/slide-whistle-up-short.wav",
	"take-move": "sounds/cartoon-take-move.wav",
	"moving-loop": "sounds/cartoon-scamper-loop.wav",
	"cancel-move": "sounds/slide-whistle-down.wav",
	// "cancel-move-in-progress": "sounds/cancel-move-in-progress.wav",
	// "speed-move-in-progress": "sounds/speed-move-in-progress.wav",
	"invalid-move": "sounds/cartoon-invalid-move.wav",
	"reveal-attacking-path": "sounds/cartoon-reveal-attacking-path.wav",
	"capture1": "sounds/capture/22-Cartoon-sound-effect.wav",
	"capture2": "sounds/capture/23-Cartoon-sound-effect.wav",
	"capture3": "sounds/capture/24-Cartoon-sound-effect.wav",
	"capture4": "sounds/capture/25-Cartoon-sound-effect.wav",
	"capture5": "sounds/capture/26-Cartoon-sound-effect.wav",
	"capture6": "sounds/capture/27-Cartoon-sound-effect.wav",
	"capture7": "sounds/capture/28-Cartoon-sound-effect.wav",
	"capture8": "sounds/capture/29-Cartoon-sound-effect.wav",
	"checkmate": "sounds/gong.wav", // neutral tone for PvP
	"win": "sounds/cartoon-beating.wav",
	"lose": "sounds/cartoon-lose.wav",
	"draw": "sounds/cartoon-pizzicato-melody.wav",
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
progressBar.removeAttribute("value"); // mark indeterminate state so it animates
(async () => {
	try {
		resources = await loadResources(resourcePaths);
	} finally {
		progressBar.style.display = "none";
	}
})();
