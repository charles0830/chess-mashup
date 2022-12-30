
import * as THREE from 'three';

import Stats from './lib/stats.module.js';
import { SVGRenderer, SVGObject } from './lib/renderers/SVGRenderer.js';
import { STLLoader } from './lib/STLLoader.js';
import { CubeControls } from './lib/cube-controls.js';
import { getBufferGeometryUtils } from './lib/BufferGeometryUtils.js';

import { playSound } from './game-audio.js';

const BufferGeometryUtils = getBufferGeometryUtils();

const turnIndicator = document.getElementById("turn-indicator");

// TODO:
// - menus
//   - preview game type with a screenshot
//   - game over
//   - win/lose tracking system
// - sound effects
//   - undo, redo, menu interactions, clicking opponent piece (when it does nothing, i.e. except at end of game, currently)
//   - maybe some variations based on theme
//   - maybe some variations based on human/computer
//   - option to disable sound effects
//   - maybe await loading sounds like I did for Dat Boi, so that *initially being in Check/Checkmate* can play a sound
//   - tweaks:
//     - add fanfare to end of win/lose
//     - use only punchy sounds for capture, there's at least one that falls short
//     - different "running" sound effect(s), maybe based on distance to travel (bongos, pat pat pat, high pitched mallet (current), maybe coconut gallop for the knight)
//     - "running" sound effect should stop before attack sound... guess I could just stop() it!
//     - slide whistle downward slide could better match upward slide... maybe just reverse the audio? or re-pitch the current sound.
//     - don't play check sound when undoing?? except maybe after a delay
//     - stagger (prevent overlap of) SFX for revealing attack paths,
//       since you can trigger it many times quickly by hovering different attacked squares
//     - maybe it should play a sound at the end of a move animation that doesn't capture, the downward slide whistle (maybe a variation; maybe the current sound, but the cancel-move should have a variation, as described above)
//     - maybe use "oh yeah" sound effect once when revealing attack path, once game is over
// - music?
//   - music volume
// - click pieces of opponent to see their possible moves (I already have this for the end of game)
// - option to show capturing paths for valid moves
// - full keyboard controls
// - persist game state in localStorage
// - option to switch between themes
// - try adding a border around the board (beveled wood, or brass)
//   - OR: to keep the checkerboard pattern consistent,
//   so that bishops have to stay on their own colors, and so it's easier to visualize where they can go,
//   try making the edges and corners of the board beveled, in a gameplay-significant way
//   (specifically, make the board a truncated cuboctahedron (beveled cube))

let stats,
	camera, controls,
	scene, renderer, webGLRenderer, svgRenderer;
const rendererContainer = document.getElementById("renderer-container");
const raycastTargets = []; // don't want to include certain objects like hoverDecal, so we can't just use scene.children

let theme = "default";
let keyframeDebug = false;
let facingDebug = false;
try {
	theme = localStorage.getItem("3d-theme");
	keyframeDebug = localStorage.getItem("3d-debug-keyframes") === "true";
	facingDebug = localStorage.getItem("3d-debug-facing") === "true";
} catch (error) {
	console.warn("Couldn't read settings from local storage", error);
}

let terrainObject3D;
let cubesByGamePosition = {};
let color1 = 0xaf0000;
let color0 = 0xffffff;

const squareSize = 30;
const cubeSegments = theme === "wireframe" ? 8 : 1;
const cubeGeometry = new THREE.BoxGeometry(squareSize, squareSize, squareSize, cubeSegments, cubeSegments, cubeSegments);

const textureLoader = new THREE.TextureLoader();

// const marbleTexture = textureLoader.load("textures/Seamless-White-Marble-Texture.webp");

const reflectionTexture = textureLoader.load('textures/2294472375_24a3b8ef46_o.jpg');
reflectionTexture.mapping = THREE.EquirectangularReflectionMapping;
reflectionTexture.encoding = THREE.sRGBEncoding;

/*const material1 = new THREE.MeshLambertMaterial({
	map: THREE.ImageUtils.loadTexture('/marble2.jpg'),
	color:color1, ambient:color1, opacity: 0.7, transparent: true
});
const material2 = new THREE.MeshLambertMaterial({
	map: THREE.ImageUtils.loadTexture('/marble1'),
	color:color2, ambient:color2, opacity: 0.7, transparent: true
});*/
let boardMat1 = new THREE.MeshPhysicalMaterial({
	color: color1,
	roughness: 0.3,
	metalness: 0.1,
	transmission: 0.3,
	opacity: 0.8,
	transparent: true,
	envMap: reflectionTexture,
	envMapIntensity: 5,
	// map: marbleTexture,
});
let boardMat0 = new THREE.MeshPhysicalMaterial({
	color: color0,
	roughness: 0.3,
	metalness: 0.4,
	transmission: 0.5,
	opacity: 0.8,
	transparent: true,
	envMap: reflectionTexture,
	envMapIntensity: 30,
	// map: marbleTexture,
});

// const tarnishedBrass = new THREE.MeshPhysicalMaterial({
// 	color: 0xf0f0a0,
// 	// emissive: 0x333344,
// 	roughness: 0.1,
// 	metalness: 0.9,
// 	envMap: reflectionTexture,
// 	envMapIntensity: 10 * envMapIntensity,
// });

// let pieceMat1 = new THREE.MeshLambertMaterial({
// 	color: 0xffffff,
// 	emissive: 0xd48a8a,
// 	ambient: color1,
// 	shininess: 1.0,
// 	specular: 0xfbbbbb,
// 	// map: textureLoader.load('./Seamless-White-Marble-Texture.webp'),
// 	envMap: reflectionTexture,
// });
let pieceMat1 = new THREE.MeshPhysicalMaterial({
	color: color1,
	roughness: 0.01,
	metalness: 0.5,
	envMap: reflectionTexture,
	envMapIntensity: 9,
});
let pieceMat0 = new THREE.MeshPhysicalMaterial({
	color: color0,
	// emissive: 0x3f3f3f,
	roughness: 0.2,
	metalness: 0.5,
	envMap: reflectionTexture,
	envMapIntensity: 9,
});

let hoveredPieceMat1 = new THREE.MeshPhysicalMaterial({
	color: color1,
	roughness: 0.01,
	metalness: 0.1,
	envMap: reflectionTexture,
	envMapIntensity: 90,
});
let hoveredPieceMat0 = new THREE.MeshPhysicalMaterial({
	color: color0,
	emissive: 0x333344,
	roughness: 0.2,
	metalness: 1.1,
	envMap: reflectionTexture,
	envMapIntensity: 14,
});
const hoverDecalTexture = textureLoader.load('./textures/hover-decal-flower-frame-with-outline.png');
// hoverDecalTexture.encoding = THREE.sRGBEncoding;

let hoverDecalMat = new THREE.MeshStandardMaterial({
	color: 0xffffff,
	emissive: 0x442200,
	transparent: true,
	// map: textureLoader.load('./textures/vintage-symmetric-frame-extrapolated.png'), // too high detail
	// alphaMap: textureLoader.load('./textures/symmetric-checkerboard-frame.jpg'), // funny
	// alphaMap: textureLoader.load('./textures/flower-frame-1436652825nLe.jpg'),
	map: hoverDecalTexture,
	// depthTest: false,
	// depthWrite: false,
	// combine: THREE.MultiplyOperation,
	fog: false,
	// hover decal should always be on top of other decals
	// (I have not played around with these values, but it seems to work)
	polygonOffset: true,
	polygonOffsetFactor: -1.0,
	polygonOffsetUnits: -4.0
});
let validMoveDecalMat = new THREE.MeshStandardMaterial({
	color: 0x44aa00,
	emissive: 0x442200,
	transparent: true,
	opacity: 0.7,
	map: hoverDecalTexture,
	fog: false,
	polygonOffset: true,
	polygonOffsetFactor: -1.0,
	polygonOffsetUnits: -1.0,
});
let invalidMoveDecalMat = new THREE.MeshStandardMaterial({
	color: 0xff6600,
	emissive: 0x442200,
	transparent: true,
	opacity: 0.7,
	map: hoverDecalTexture,
	fog: false,
	polygonOffset: true,
	polygonOffsetFactor: -1.0,
	polygonOffsetUnits: -1.0,
});

if (theme === "wireframe" || theme === "perf") {
	color1 = 0xffffff;
	color0 = 0xff0000;
	if (theme === "perf") {
		// boardMat1 = new THREE.MeshBasicMaterial({ color: "lime" });
		// boardMat0 = new THREE.MeshBasicMaterial({ color: "green" });
		boardMat1 = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
		boardMat0 = new THREE.MeshBasicMaterial({ color: 0xcccccc });
	} else {
		boardMat1 = new THREE.MeshBasicMaterial({ color: "lime", wireframe: true });
		boardMat0 = new THREE.MeshBasicMaterial({ color: "green", wireframe: true });
		// boardMat1 = new THREE.MeshBasicMaterial({ color: "white", wireframe: true });
		// boardMat0 = new THREE.MeshBasicMaterial({ color: "black", wireframe: true });
	}
	pieceMat0 = new THREE.MeshBasicMaterial({ color: color1, wireframe: true });
	pieceMat1 = new THREE.MeshBasicMaterial({ color: color0, wireframe: true });
	hoveredPieceMat0 = new THREE.MeshBasicMaterial({ color: color1, wireframe: true, fog: false });
	hoveredPieceMat1 = new THREE.MeshBasicMaterial({ color: color0, wireframe: true, fog: false });
	hoverDecalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, fog: false, });

	validMoveDecalMat = new THREE.MeshBasicMaterial({
		color: 0x00ff00,
		opacity: theme === "wireframe" ? 1 : 0.5,
		transparent: theme !== "wireframe",
		wireframe: theme === "wireframe",
		fog: theme !== "wireframe",
	});
	invalidMoveDecalMat = new THREE.MeshBasicMaterial({
		color: 0xffaa00,
		opacity: theme === "wireframe" ? 1 : 0.5,
		transparent: theme !== "wireframe",
		wireframe: theme === "wireframe",
		fog: theme !== "wireframe",
	});
}


function makeDecal(material) {
	return new THREE.Mesh(new THREE.PlaneGeometry(squareSize, squareSize), material);
}
function positionDecalWorldSpace(decalMesh, worldPosition, faceNormal) {
	decalMesh.position.copy(worldPosition);
	const zFightingOffset =
		theme === "default" ? 0 :
			(decalMesh.material === hoverDecalMat ? 1 : 0.5);
	decalMesh.position.add(faceNormal.clone().multiplyScalar(squareSize / 2 + zFightingOffset));
	const axis = new THREE.Vector3(0, 0, 1);
	decalMesh.quaternion.setFromUnitVectors(axis, faceNormal);
}

function makeMovePath(move, material) {
	const points = move.keyframes
		.filter(({ goingOverEdge }) => !goingOverEdge)
		.map(
			({ gamePosition, towardsGroundVector }) =>
				gameToWorldSpace(gamePosition)
			//.add(towardsGroundVector.clone().multiplyScalar(squareSize / 2.91))
		);
	// console.log(move.keyframes, points);
	if (points.length < 3) {
		points.push(points[0].clone().add(new THREE.Vector3(0, 0, 0.1)));
	}
	if (points.length < 3) {
		points.push(points[0].clone().add(new THREE.Vector3(0, 0.1, 0)));
	}
	// const spline = new THREE.CatmullRomCurve3(points);
	const lineGeometry = new THREE.BufferGeometry();
	const pointData = new Float32Array(points.length * 3);
	for (let i = 0; i < points.length; i++) {
		pointData[i * 3] = points[i].x;
		pointData[i * 3 + 1] = points[i].y;
		pointData[i * 3 + 2] = points[i].z;
	}
	lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointData, 3));
	const path = new THREE.Line(lineGeometry, material || new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 }));
	const object3d = new THREE.Object3D();
	object3d.add(path);

	if (keyframeDebug) {
		// Debug: visualize the animation keyframes as arrows
		const arrowsByCell = {};
		for (const [i, keyframe] of Object.entries(move.keyframes)) {
			const point = gameToWorldSpace(keyframe.gamePosition);
			const { x, y, z } = keyframe.gamePosition;

			arrowsByCell[`${x},${y},${z}`] = (arrowsByCell[`${x},${y},${z}`] || 0) + 1;
			const arrowsInThisCellAlready = arrowsByCell[`${x},${y},${z}`] - 1;
			// shift to where there's (hopefully) room for this arrow
			// (there may be overlapping move paths, which don't share arrowsByCell, so this isn't perfect)
			point.add(new THREE.Vector3(0, 0, arrowsInThisCellAlready * squareSize * 0.1));

			// const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(keyframe.orientation);
			const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(keyframe.orientation);
			// const direction = move.towardsGroundVector; // a different thing
			const arrowHelper = new THREE.ArrowHelper(
				direction,
				point,
				10, `hsl(${i * 20}, 100%, 50%)`, 6, 4
			);
			object3d.add(arrowHelper);
		}
	}

	return object3d;
}


const hoverDecal = makeDecal(hoverDecalMat);

const stlLoader = new STLLoader();
const pieceTypes = [
	"pawn",
	"knight",
	"bishop",
	"rook",
	"queen",
	"king",
];
const geometryPromises = pieceTypes.map((pieceType) => new Promise((resolve, reject) => {
	const url = `models/classic_${pieceType}.stl`;
	stlLoader.load(
		url,
		(geometry) => { // Success callback
			geometry.deleteAttribute("normal");
			// geometry.deleteAttribute("uv");
			// geometry.deleteAttribute("uv2");
			// geometry.deleteAttribute("tangent");
			geometry = BufferGeometryUtils.mergeVertices(geometry);
			geometry.computeVertexNormals();
			// geometry.computeFaceNormals();
			resolve(geometry);
		},
		(progressEvent) => {
			// Progress callback
			// console.log(`${url}: ${Math.floor(progressEvent.loaded / progressEvent.total * 100)}%`);
		},
		(errorOrEvent) => {
			// Failure callback, gets a ProgressEvent in case of a file download failure
			if (errorOrEvent instanceof Event) {
				const xhr = errorOrEvent.currentTarget;
				reject(new Error(`Could not load ${url}: ${xhr.status} ${xhr.statusText}`));
			} else {
				reject(errorOrEvent);
			}
		}
	);
}));

const BOARD_SIZE = 8; // metacube board size in cubes/squares/cells

let teamNames = ["White", "Red"];
let teamTypes;
let turnMessages;
function setTeams(playerCount) {
	if (playerCount === 1) {
		teamTypes = ["human", "computer"];
		turnMessages = ["Your turn (White)", "Compu-turn (Red)"];
	} else {
		teamTypes = ["human", "human"];
		turnMessages = ["White's turn", "Red's turn"];
	}
}
let turn = 0;
let gameOver = false;
let moveInProgress = false;
let raycaster;
const intersects = [];
let hoveredPiece;
let hoveredSpace;
let hoveredTowardsGroundVector;
let selectedPiece;
const allPieces = [];
const livingPieces = [];
const capturedPieces = [];
let movementDecals = [];
let spaceHoverDecals = [];
let revealedAttackingPath = {};

const mouse = { x: null, y: null };

let undos = [];
let redos = [];

function undo(secondTime) {
	if (undos.length === 0) {
		return;
	}
	const state = undos.pop();
	redos.push(serialize());
	deserialize(state);
	if (teamTypes[turn % 2] === "computer") {
		undo(true);
	}
	if (!secondTime) {
		handleTurn();
	}
}
function redo() {
	if (redos.length === 0) {
		return;
	}
	const state = redos.pop();
	undos.push(serialize());
	deserialize(state);
	handleTurn();
}
function serialize() {
	return JSON.stringify({
		turn: turn,
		gameOver: gameOver,
		teamTypes: teamTypes,
		teamNames: teamNames,
		turnMessages: turnMessages,
		livingPieces: livingPieces.map(piece => piece.serialize()),
		capturedPieces: capturedPieces.map(piece => piece.serialize()),
	});
}
function deserialize(json) {
	const state = JSON.parse(json);
	turn = state.turn;
	gameOver = state.gameOver;
	teamTypes = state.teamTypes;
	teamNames = state.teamNames;
	turnMessages = state.turnMessages;

	// TODO: handle different starting pieces, i.e. different set of pieces

	for (let serializedPiece of state.livingPieces) {
		for (const existingPiece of allPieces) {
			if (existingPiece.id === serializedPiece.id) {
				if (capturedPieces.includes(existingPiece)) {
					capturedPieces.splice(capturedPieces.indexOf(existingPiece), 1);
					livingPieces.push(existingPiece);
					existingPiece.addBackToScene();
				}
				existingPiece.deserialize(serializedPiece);
				break;
			}
		}
	}
	for (let serializedPiece of state.capturedPieces) {
		for (const existingPiece of allPieces) {
			if (existingPiece.id === serializedPiece.id) {
				if (livingPieces.includes(existingPiece)) {
					livingPieces.splice(livingPieces.indexOf(existingPiece), 1);
					capturedPieces.push(existingPiece);
					existingPiece.removeFromScene();
				}
				existingPiece.deserialize(serializedPiece);
				break;
			}
		}
	}

	selectedPiece = null;
	clearMovementDecals();

	moveInProgress = false;
}

function clearMovementDecals() {
	for (const decal of movementDecals) {
		scene.remove(decal);
	}
	movementDecals.length = 0;
	revealedAttackingPath = {};
}

addEventListener('mousemove', function (event) {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = 1 - (event.clientY / window.innerHeight) * 2;
}, true);

rendererContainer.addEventListener('mousedown', function (event) {
	if (event.button !== 0) return;
	// console.log(`Clicked piece: ${hoveredPiece}`);
	if (hoveredPiece &&
		(
			(
				teamTypes[hoveredPiece.team] === "human" &&
				turn % 2 === hoveredPiece.team &&
				!moveInProgress
			) ||
			gameOver ||
			event.ctrlKey // cheat
		)
	) {
		if (selectedPiece !== hoveredPiece) {
			playSound("lift-piece");
		}
		selectedPiece = hoveredPiece;
		clearMovementDecals();
		const moves = getMoves(hoveredPiece);
		// console.log(moves);
		for (const move of moves) {
			const decal = makeDecal(move.valid ? validMoveDecalMat : invalidMoveDecalMat);
			const towardsGroundVector = move.towardsGroundVector;
			const awayFromGroundVector = towardsGroundVector.clone().negate();
			const decalWorldPosition = gameToWorldSpace(move.gamePosition.clone().add(towardsGroundVector));
			positionDecalWorldSpace(decal, decalWorldPosition, awayFromGroundVector);
			movementDecals.push(decal);
			scene.add(decal);
			const path = makeMovePath(move, move.valid ? null : new THREE.LineBasicMaterial({ color: 0xffcc22, linewidth: 3 }));
			scene.add(path);
			movementDecals.push(path);
		}
	} else if (selectedPiece) {
		if (hoveredSpace) {
			const movesHere = getMoves(selectedPiece).filter(move =>
				move.gamePosition.equals(hoveredSpace) &&
				move.towardsGroundVector.equals(hoveredTowardsGroundVector)
			);
			let move = movesHere.find(move => move.valid);
			if (event.ctrlKey) {
				// allow cheating with Ctrl-click
				const orientation = new THREE.Quaternion().setFromUnitVectors(
					new THREE.Vector3(0, -1, 0),
					hoveredTowardsGroundVector.clone(),
				);
				move = {
					gamePosition: hoveredSpace,
					gameOrientation: orientation,
					towardsGroundVector: hoveredTowardsGroundVector, // technically redundant with gameOrientation
					keyframes: [{
						gamePosition: hoveredSpace,
						orientation: orientation,
					}, {
						gamePosition: hoveredSpace,
						orientation: orientation,
					}],
					piece: selectedPiece,
					valid: false, // honest to god, this is a cheat
					capturingPiece: pieceAtGamePosition(hoveredSpace),
					capturingDirectionVector: hoveredTowardsGroundVector.clone().negate(), // fake
					direction: [1, 0], // fake
					distance: 1, // fake
				};
			}
			if (move) {
				selectedPiece.takeMove(move, handleTurn);
				turn++;
			} else if (movesHere.length) {
				playSound("invalid-move");
			}
		}
		selectedPiece = null;
		clearMovementDecals();
	}
}, true);

addEventListener('mouseleave', function (event) {
	mouse.x = null;
	mouse.y = null;
}, true);

addEventListener('blur', function (event) {
	mouse.x = null;
	mouse.y = null;
}, true);

addEventListener('keydown', function (event) {
	// Escape
	if (event.keyCode === 27) {
		if (selectedPiece) {
			selectedPiece = null;
			clearMovementDecals();
		}
	}
	// Ctrl+Z or Cmd+Z
	if (event.keyCode === 90 && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
		undo();
	}
	// Ctrl+Y or Cmd+Y
	if (event.keyCode === 89 && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
		redo();
	}
	// Ctrl+Shift+Z or Cmd+Shift+Z
	if (event.keyCode === 90 && event.shiftKey && (event.ctrlKey || event.metaKey) && !event.altKey) {
		redo();
	}
}, true);

// function worldToGameSpace(worldPosition) {
// 	return worldPosition.clone().divideScalar(squareSize).floor();
// }
function gameToWorldSpace(gamePosition) {
	return gamePosition.clone().subScalar((BOARD_SIZE - 1) / 2).multiplyScalar(squareSize);
}

let pieceIdCounter = 0;
class Piece {
	constructor(x, y, z, orientation, team, pieceType) {
		this.startingGamePosition = new THREE.Vector3(x, y, z);
		this.gamePosition = this.startingGamePosition.clone();
		this.gameOrientation = orientation.clone();
		this.targetWorldPosition = gameToWorldSpace(this.gamePosition); // for animation only
		this.targetOrientation = this.gameOrientation.clone(); // for animation only
		this.team = team;
		this.pieceType = pieceType || "pawn";
		this.object3d = new THREE.Object3D();
		// WebGL mode
		this.defaultMaterial = team == 0 ? pieceMat0 : pieceMat1;
		this.hoverMaterial = team == 0 ? hoveredPieceMat0 : hoveredPieceMat1;
		// SVG mode
		this.defaultSpriteMaterial = new THREE.SpriteMaterial({});
		this.defaultSpriteMaterial.styleForSVGRenderer = `fill: url(#image-pattern-${this.team ? "b" : "w"}-${pieceType});`;
		this.hoverSpriteMaterial = new THREE.SpriteMaterial({});
		this.hoverSpriteMaterial.styleForSVGRenderer = `fill: url(#image-pattern-${this.team ? "b" : "w"}-${pieceType});`;
		this.hoverSpriteMaterial.styleForSVGRenderer += "filter: brightness(150%) drop-shadow(0px 0px 10px white)"
		this.sprite = new THREE.Sprite(this.defaultSpriteMaterial);
		this.sprite.scale.set(30, 30, 1);
		this.sprite.position.y -= squareSize / 15;
		// Raycasting mesh,
		// which is also a preload visual before the piece's model (WebGL) or image (SVG) load.
		const tempGeometry = new THREE.CylinderGeometry(10, 10, 1, 8, 1, false);
		const tempMesh = new THREE.Mesh(tempGeometry, this.defaultMaterial);
		tempMesh.scale.y = 30;
		tempMesh.position.y = (tempMesh.scale.y - squareSize) / 2;
		this.object3d.add(tempMesh);
		this.raycastMesh = tempMesh;
		this.visualMesh = tempMesh;
		this.visualObject = tempMesh;
		raycastTargets.push(this.raycastMesh);

		this.setPieceType(pieceType);

		if (facingDebug) {
			const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 10, 0), 20, 0x00aa00, 10, 8);
			this.object3d.add(arrowHelper);
		}
		this.object3d.position.copy(gameToWorldSpace(this.gamePosition));
		this.object3d.quaternion.copy(this.gameOrientation);
		scene.add(this.object3d);
		this.object3d.piece = this;
		this.distanceForward = 0; // used for pawn promotion
		this.id = "piece_" + pieceIdCounter++;
		this.wasSelectedAsOfLastFrame = false;
	}
	get towardsGroundVector() {
		// Note: applyQuaternion gives imprecise results, so we have to round it.
		return new THREE.Vector3(0, -1, 0).applyQuaternion(this.gameOrientation).round();
	}
	removeFromScene() {
		scene.remove(this.object3d);
		const index = raycastTargets.indexOf(this.raycastMesh);
		if (index > -1) {
			raycastTargets.splice(index, 1);
		}
	}
	addBackToScene() {
		scene.add(this.object3d);
		raycastTargets.push(this.raycastMesh);
	}
	serialize() {
		return {
			id: this.id,
			x: this.gamePosition.x,
			y: this.gamePosition.y,
			z: this.gamePosition.z,
			startingX: this.startingGamePosition.x,
			startingY: this.startingGamePosition.y,
			startingZ: this.startingGamePosition.z,
			orientation: this.gameOrientation.toArray(),
			team: this.team,
			pieceType: this.pieceType,
			distanceForward: this.distanceForward,
		};
	}
	deserialize(data) {
		this.id = data.id;
		this.gamePosition.x = data.x;
		this.gamePosition.y = data.y;
		this.gamePosition.z = data.z;
		this.startingGamePosition.x = data.startingX;
		this.startingGamePosition.y = data.startingY;
		this.startingGamePosition.z = data.startingZ;
		this.gameOrientation.fromArray(data.orientation);
		this.targetOrientation.fromArray(data.orientation);
		this.team = data.team;
		this.setPieceType(data.pieceType);
		this.distanceForward = data.distanceForward;
		this.targetWorldPosition = gameToWorldSpace(this.gamePosition);
		this.object3d.position.copy(this.targetWorldPosition);
		this.object3d.quaternion.copy(this.targetOrientation);
		this.cancelAnimation();
		this.object3d.visible = true; // reset from capturing animation (in multiple places)
	}
	setPieceType(pieceType) {
		this.pieceType = pieceType;
		const index = pieceTypes.indexOf(this.pieceType);
		geometryPromises[Math.max(0, index)].then((geometry) => {
			this.visualMesh = new THREE.Mesh(geometry, this.defaultMaterial);
			geometry.computeBoundingBox();
			this.raycastMesh.scale.y = geometry.boundingBox.max.z - geometry.boundingBox.min.z;
			this.raycastMesh.position.y = this.raycastMesh.scale.y / 2 - squareSize / 2;

			this.visualMesh.rotation.x -= Math.PI / 2;
			this.visualMesh.position.y -= squareSize / 2;

			const svg = svgRenderer.domElement;
			if (!svg.querySelector("defs")) {
				const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
				svg.appendChild(defs);
				defs.preventRemoval = true;
				for (const pieceType of pieceTypes) {
					for (const teamBWCode of "bw") {
						const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
						pattern.setAttribute("id", `image-pattern-${teamBWCode}-${pieceType}`);
						pattern.setAttribute("x", "0");
						pattern.setAttribute("y", "0");
						pattern.setAttribute("width", "1");
						pattern.setAttribute("height", "1");
						pattern.setAttribute("viewBox", "0 0 1024 1024");
						const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
						image.setAttribute("href", `textures/JohnPablok%20Cburnett%20Chess%20set/SVG%20with%20shadow/${teamBWCode}_${pieceType}_svg_withShadow.svg`);
						image.setAttribute("width", "1024");
						image.setAttribute("height", "1024");
						pattern.appendChild(image);
						defs.appendChild(pattern);
					}
				}
			}

			// Keep raycastMesh around, invisibly, for raycasting,
			// but switch to a detailed visual mesh or sprite.
			const newVisualObject = renderer === svgRenderer ? this.sprite : this.visualMesh;
			this.raycastMesh.visible = false;
			if (this.visualObject !== this.raycastMesh) {
				this.object3d.remove(this.visualObject);
			}
			this.visualObject = newVisualObject;
			this.object3d.add(this.visualObject);
		});
	}
	takeMove(move, callback) {
		// console.log(move);
		if (gameOver) {
			return;
		}
		if (moveInProgress) {
			return;
		}
		undos.push(serialize());
		redos.length = 0;

		moveInProgress = true;

		const { capturingPiece } = move;
		if (capturingPiece) {
			// we will remove it from the scene after the animation!
			// update the game state immediately, so it's easier to implement consistent mechanics
			livingPieces.splice(livingPieces.indexOf(capturingPiece), 1);
			capturedPieces.push(capturingPiece);
		}

		// this.distanceForward += move.direction[0]; // must correspond to pawn's forward direction!
		this.distanceForward -= move.direction[1]; // must correspond to pawn's forward direction!

		const path = makeMovePath(move);
		scene.add(path);
		this.movePath = path;

		this.gamePosition.copy(move.gamePosition);
		this.gameOrientation.copy(move.gameOrientation);

		playSound("take-move");
		this.movingLoopBufferSource = playSound("moving-loop", { looping: true }).bufferSource;

		this.animating = true;
		let animIndex = 0;
		clearInterval(this.timerId);
		this.timerId = setInterval(() => {
			const keyframe = move.keyframes[animIndex];
			const { gamePosition, orientation } = keyframe;
			this.targetWorldPosition = gameToWorldSpace(gamePosition);
			this.targetOrientation.copy(orientation);
			animIndex++;
			if (animIndex >= move.keyframes.length) {
				clearInterval(this.timerId);
				// it hasn't quite stopped animating yet
				// there's still the transition to the final position
				// Note: clearInterval works with setTimeout IDs too!
				this.timerId = setTimeout(() => {
					this.animating = false;
					moveInProgress = false;
					if (capturingPiece) {
						capturingPiece.removeFromScene();
						// capturingPiece.object3d.visible = false;
					}
					scene.remove(path);
					if (move.promotion) {
						this.setPieceType("queen"); // TODO: choice of piece type
					}
					this.movingLoopBufferSource?.stop(0);
					callback();
				}, capturingPiece ? 1000 : 300);
			}
			// animate capturing as the piece moves into the final position
			if (keyframe.capturingPiece) {
				keyframe.capturingPiece.beingCaptured = true;
				keyframe.capturingPiece.targetWorldPosition.add(
					move.capturingDirectionVector.clone().multiplyScalar(squareSize),
				);
				playSound(`capture${1 + Math.floor(Math.random() * 8)}`);
			}
		}, 300);
	}
	cancelAnimation() {
		clearInterval(this.timerId);
		this.animating = false;
		this.beingCaptured = false;
		// TODO: persist path so you can see what moved when it was on the other side of the board etc.
		// but hide it when selecting a piece because it could be confusing
		scene.remove(this.movePath);
		this.movingLoopBufferSource?.stop(0);
	}
	update() {
		const slowness = 10;
		this.object3d.position.x += (this.targetWorldPosition.x - this.object3d.position.x) / slowness;
		this.object3d.position.y += (this.targetWorldPosition.y - this.object3d.position.y) / slowness;
		this.object3d.position.z += (this.targetWorldPosition.z - this.object3d.position.z) / slowness;
		this.object3d.quaternion.slerp(this.targetOrientation, 1 / slowness);
		// this.object3d.rotation.y = -Math.atan2(mouse.x, mouse.y);
		// this.object3d.quaternion.rotateTowards(this.targetOrientation, 0.05);
		// lift the piece up when selected, or when animating
		if (selectedPiece === this || this.animating) {
			// this.object3d.position.add(this.towardsGroundVector.clone().multiplyScalar(-0.5));

			const lift = new THREE.Vector3(0, 0.5, 0);
			lift.applyQuaternion(this.targetOrientation);
			this.object3d.position.add(lift);
		} else if (this.wasSelectedAsOfLastFrame) {
			playSound("cancel-move");
		}
		// wiggle the piece gently when it's selected
		// if (selectedPiece === this) {
		// 	this.object3d.rotation.z += Math.sin(Date.now() / 500) / 150;
		// }
		// capturing animation
		if (this.beingCaptured) {
			this.object3d.rotation.y -= 0.1;
			this.object3d.rotation.z -= 0.1;
			this.object3d.rotation.x -= 0.1;
			this.targetWorldPosition.add(this.towardsGroundVector.clone().multiplyScalar(-0.5));
			this.object3d.visible = Math.random() < 0.8;
		}

		this.wasSelectedAsOfLastFrame = selectedPiece === this;

		if (renderer === svgRenderer) {
			// const cameraSpaceVector = this.towardsGroundVector.clone().project(camera); approximation or alternative
			const cameraSpaceVector = this.object3d.position.clone().project(camera).sub(this.object3d.position.clone().sub(this.towardsGroundVector).project(camera));
			const rotation = Math.atan2(-cameraSpaceVector.x, -cameraSpaceVector.y);
			this.defaultSpriteMaterial.rotation = rotation;
			this.hoverSpriteMaterial.rotation = rotation;
		}
	}
	updateHovering(hovering) {
		if (renderer === svgRenderer) {
			this.visualObject.material = !hovering ? this.defaultSpriteMaterial : this.hoverSpriteMaterial;
			this.sprite.scale.set(30 + hovering * 2, 30 + hovering * 2, 1);
		} else {
			this.visualObject.material = !hovering ? this.defaultMaterial : this.hoverMaterial;
		}
	}
	toString() {
		const { x, y, z } = this.gamePosition;
		return `${teamNames[this.team]} ${this.pieceType} at (${x},${y},${z})`;
	}
}

const letterToPieceType = {
	"p": "pawn",
	"r": "rook",
	"b": "bishop",
	"q": "queen",
	"k": "king",
	"n": "knight",
};
const boardPresets = {
	sillyDense: [
		". . . . . . . .",
		". p p p p p p .",
		". p r n n r p .",
		". p n k q n p .",
		". p n b b n p .",
		". p r n n r p .",
		". p p p p p p .",
		". . . . . . . .",
	],
	slightlyLessSillyAndDense: [
		". . . . . . . .",
		". n p p p p n .",
		". p r . . r p .",
		". p . k q . p .",
		". p . b b . p .",
		". p r . . r p .",
		". n p p p p n .",
		". . . . . . . .",
	],
	bastionFort: [
		"r r r . . r r r",
		"r . r r r r . r",
		"r r . . . . r r",
		". r . k q . r .",
		". r . b b . r .",
		"r r . . . . r r",
		"r . r r r r . r",
		"r r r . . r r r",
	],
	smileyFace: [
		". . . . . . . .",
		". . k . . b . .",
		". . q . . b . .",
		". . . . . . . .",
		"n r . . . . r n",
		". n . . . . n .",
		". . p p p p . .",
		". . . . . . . .",
	],
	mostMinimal: [
		". . . . . . . .",
		"k . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
	],
	orthodox: [
		"r n b q k b n r",
		"p p p p p p p p",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
		". . . . . . . .",
	],
};

function destroyWorld() {
	// Note to self: don't let AI autocomplete this function

	if (!terrainObject3D) {
		return;
	}
	scene.remove(terrainObject3D);
	scene.remove(hoverDecal);

	clearMovementDecals();

	terrainObject3D = null;
	// hoverDecal = null; const

	for (const piece of allPieces) {
		scene.remove(piece.object3d);
	}
	allPieces.length = 0;
	livingPieces.length = 0;
	raycastTargets.length = 0;

	cubesByGamePosition = {};

	turn = 0;
	gameOver = false;
	moveInProgress = false;
	selectedPiece = null;

	controls.reset();
}

function initWorld(game, worldSize) {
	destroyWorld();

	if (game !== "voxel-chess" || isNaN(worldSize)) {
		worldSize = BOARD_SIZE;
	}

	// Create Board / Terrain
	terrainObject3D = new THREE.Object3D();
	for (let x = 0; x < worldSize; x++) {
		for (let y = 0; y < worldSize; y++) {
			for (let z = 0; z < (game === "almost-chess" ? 1 : worldSize); z++) {
				// if (z % 3 != 0 || x % 3 != 0 || y % 3 != 0) continue;
				if (game === "voxel-chess") {
					// TODO: guarantee one cube
					if (Math.hypot(
						x - (worldSize - 1) / 2,
						y - (worldSize - 1) / 2,
						z - (worldSize - 1) / 2
					) ** 1.3 > Math.random() * worldSize) continue;
				}
				const mesh = new THREE.Mesh(cubeGeometry, ((x + y + z) % 2) ? boardMat1 : boardMat0);
				// mesh.visible = x === 0 || x === worldSize - 1 || y === 0 || y === worldSize - 1 || z === 0 || z === worldSize - 1;
				mesh.gamePosition = new THREE.Vector3(x, y, z);
				mesh.position.copy(gameToWorldSpace(mesh.gamePosition));
				mesh.updateMatrix();
				mesh.matrixAutoUpdate = false;
				terrainObject3D.add(mesh);
				raycastTargets.push(mesh);
				cubesByGamePosition[`${x},${y},${z}`] = mesh;
			}
		}
	}
	scene.add(terrainObject3D);
	scene.add(hoverDecal);

	// Create Pieces
	for (let team = 0; team <= 1; team++) {
		const z = (team === 0 || game === "almost-chess") ? -1 : worldSize;
		const boardPresetID = game === "almost-chess" ? "orthodox" : "slightlyLessSillyAndDense";
		const initialBoard = boardPresets[boardPresetID].map(line => line.split(" "));

		for (let y = 0; y < initialBoard.length; y++) {
			for (let x = 0; x < initialBoard[y].length; x++) {
				const letter = initialBoard[y][x];
				if (letter in letterToPieceType) {
					const pieceType = letterToPieceType[letter];
					const quaternion = new THREE.Quaternion();
					if (game === "almost-chess") {
						// TODO: cleanup
						quaternion.setFromUnitVectors(
							new THREE.Vector3(0, -1, 0),
							new THREE.Vector3(0, 0, 1),
						).premultiply(new THREE.Quaternion().setFromUnitVectors(
							new THREE.Vector3(0, 1, 0),
							new THREE.Vector3(team === 0 ? 0 : 1, 0, 0),
						)).premultiply(new THREE.Quaternion().setFromUnitVectors(
							new THREE.Vector3(0, 1, 0),
							new THREE.Vector3(team === 0 ? 0 : 1, 0, 0),
						));
					} else {
						quaternion.setFromUnitVectors(
							new THREE.Vector3(0, -1, 0),
							new THREE.Vector3(0, 0, team === 0 ? 1 : -1),
						);
					}
					const pieceY = (game === "almost-chess" && team === 1) ? y : worldSize - 1 - y;
					const piece = new Piece(x, pieceY, z, quaternion, team, pieceType);
					allPieces.push(piece);
					livingPieces.push(piece);
				}
			}
		}

	}
	if (game === "voxel-chess") {
		// Settle pieces onto the terrain
		for (let i = 0; i < worldSize; i++) {
			for (const piece of livingPieces) {
				const pos = piece.gamePosition.clone().add(piece.towardsGroundVector);
				if (!cubeAtGamePosition(pos) && !pieceAtGamePosition(pos)) {
					piece.gamePosition.add(piece.towardsGroundVector);
					// Need to also update values computed from gamePosition, below.
				}
			}
		}
		// Force pieces onto terrain, or destroy them
		// King is required.
		let freeSpots = [];
		let occupiedSpots = [];
		const directions = [
			new THREE.Vector3(0, -1, 0),
			new THREE.Vector3(0, 1, 0),
			new THREE.Vector3(0, 0, -1),
			new THREE.Vector3(0, 0, 1),
			new THREE.Vector3(1, 0, 0),
			new THREE.Vector3(-1, 0, 0),
		];
		for (const cube of Object.values(cubesByGamePosition)) {
			for (const direction of directions) {
				const pos = cube.gamePosition.clone().add(direction);
				pos._cube_face_direction = direction; // @HACK
				if (!cubeAtGamePosition(pos)) {
					const piece = pieceAtGamePosition(pos);
					if (!piece) {
						freeSpots.push(pos);
					} else if (piece.pieceType !== "king") { // don't even THINK about removing kings (even to make way for a king)
						occupiedSpots.push(pos);
					}
				}
			}
		}
		const forceOntoTerrain = (piece, priority) => {
			freeSpots.sort((a, b) =>
				Math.hypot(a.x - piece.gamePosition.x, a.y - piece.gamePosition.y, a.z - piece.gamePosition.z) -
				Math.hypot(b.x - piece.gamePosition.x, b.y - piece.gamePosition.y, b.z - piece.gamePosition.z)
			);
			let pos = freeSpots.shift();
			if (priority && !pos) {
				occupiedSpots.sort((a, b) =>
					Math.hypot(a.x - piece.gamePosition.x, a.y - piece.gamePosition.y, a.z - piece.gamePosition.z) -
					Math.hypot(b.x - piece.gamePosition.x, b.y - piece.gamePosition.y, b.z - piece.gamePosition.z)
				);
				pos = occupiedSpots.shift();
			}
			if (!pos) {
				return false;
			}

			const occupier = pieceAtGamePosition(pos);
			if (occupier) {
				if (priority) {
					const index = livingPieces.indexOf(occupier);
					if (index > -1) {
						livingPieces.splice(index, 1);
						capturedPieces.push(occupier);
						occupier.removeFromScene();
					}
				} else {
					console.warn("Spot occupied, while trying to place piece with low priority.");
					return false;
				}
			}

			// Need to also update values computed from gamePosition, done outside this function, below.
			piece.gamePosition.copy(pos);
			piece.gameOrientation.setFromUnitVectors(
				new THREE.Vector3(0, 1, 0),
				pos._cube_face_direction, // @HACK
			);

			// Important for King's priority
			occupiedSpots.push(pos);

			// freeSpots.shift() won't remove all spots that are now occupied,
			// for spots that share a cell (differing only in orientation)
			freeSpots = freeSpots.filter((v) => !v.equals(pos));

			return true;
		};
		let placeTeam = 1; // balance slight advantage of priority in placing one piece on the map, by giving it to the player who goes second (theoretically)
		const toPlace = allPieces.filter((piece) => {
			const pos = piece.gamePosition.clone().add(piece.towardsGroundVector);
			return !cubeAtGamePosition(pos);
		});
		while (toPlace.length) { // not using livingPieces because it's modified in this loop
			const index = toPlace.findIndex((piece) => piece.team === placeTeam);
			placeTeam = +!placeTeam;
			if (index > -1) {
				const piece = toPlace.splice(index, 1)[0];
				// Try to place piece...
				if (!forceOntoTerrain(piece, piece.pieceType === "king")) {
					// Failed to place piece, so destroy it.
					const index = livingPieces.indexOf(piece);
					if (index > -1) {
						livingPieces.splice(index, 1);
						capturedPieces.push(piece);
						piece.removeFromScene();
					}
				}
			}
		}
		// Update position (values computed therefrom)
		for (const piece of allPieces) {
			piece.startingGamePosition = piece.gamePosition;
			piece.deserialize(piece.serialize());
		}
	}
}

function initRendering() {

	scene = new THREE.Scene();

	if (theme === "wireframe" || theme === "perf") {
		scene.fog = new THREE.FogExp2(0x000000, 0.002);
	}

	raycaster = new THREE.Raycaster();

	// lighting

	// Note: the environment map (envMap) also provides light.
	const ambientLight = new THREE.AmbientLight(0xaaaaaa);
	scene.add(ambientLight);


	// renderer

	svgRenderer = new SVGRenderer();
	if (Detector.webgl) {
		webGLRenderer = new THREE.WebGLRenderer({
			antialias: (theme === "wireframe" || theme === "perf") ? false : true
		});
		renderer = webGLRenderer;
	} else {
		renderer = svgRenderer;
	}
	// renderer.setClearColor(scene.fog.color, 1);
	svgRenderer.setSize(window.innerWidth, window.innerHeight);
	if (webGLRenderer) {
		webGLRenderer.setSize(window.innerWidth, window.innerHeight);
		webGLRenderer.outputEncoding = THREE.sRGBEncoding;

		let webGLLoseContext;
		window.testLoseContext = () => {
			webGLLoseContext = webGLRenderer.getContext().getExtension('WEBGL_lose_context');
			webGLLoseContext.loseContext();
		};
		window.testRestoreContext = () => {
			webGLLoseContext.restoreContext();
		};
		webGLRenderer.domElement.addEventListener("webglcontextlost", function (event) {
			event.preventDefault();
			renderer = svgRenderer;
			rendererContainer.appendChild(svgRenderer.domElement);
			webGLRenderer.domElement.style.display = "none";
			svgRenderer.domElement.style.display = "";
			// update mesh to svg sprite
			for (const piece of allPieces) {
				piece.setPieceType(piece.pieceType);
			}
		}, false);

		webGLRenderer.domElement.addEventListener("webglcontextrestored", function (event) {
			renderer = webGLRenderer;
			svgRenderer.domElement.style.display = "none";
			webGLRenderer.domElement.style.display = "";
			// update svg sprite to mesh
			for (const piece of allPieces) {
				piece.setPieceType(piece.pieceType);
			}
		}, false);
	}

	rendererContainer.appendChild(renderer.domElement);

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '';
	stats.domElement.style.bottom = '0px';
	stats.domElement.style.zIndex = 100;
	document.getElementById("stats-and-renderer-container").appendChild(stats.domElement);

	// camera

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.z = -500;
	camera.near = 0.1;
	camera.far = 1000;

	controls = new CubeControls(camera, rendererContainer); // using a container so we don't need to recreate this object
	controls.noPan = true; // panning already doesn't work but this makes it not give state === STATE.PANNING (with my modifications)
	controls.minDistance = squareSize * BOARD_SIZE;
	controls.maxDistance = squareSize * BOARD_SIZE * 3;

	//

	window.addEventListener('resize', onWindowResize, false);

	// this texture can look really bad without anisotropic filtering
	// at an angle or from far away,
	// due to the black border around the white ornamentation
	if (renderer.capabilities) {
		const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
		hoverDecalTexture.anisotropy = maxAnisotropy;
	}
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	svgRenderer.setSize(window.innerWidth, window.innerHeight);
	webGLRenderer?.setSize(window.innerWidth, window.innerHeight);
	controls.handleResize();
}

function animate() {
	requestAnimationFrame(animate);
	stats.update();

	for (let i = 0; i < allPieces.length; i++) {
		allPieces[i].update();
	}
	controls.update();

	// clear hover state of previously hovered piece
	if (hoveredPiece) {
		hoveredPiece.updateHovering(false);
	}
	hoveredPiece = null;

	// clear hover state of board
	hoverDecal.visible = false;
	hoveredSpace = null;
	hoveredTowardsGroundVector = null;

	// find hovered piece and/or board space and highlight it
	if (mouse.x != null && mouse.y != null && controls.state === controls.STATE.NONE) {
		raycaster.setFromCamera(mouse, camera);
		intersects.length = 0;
		raycaster.intersectObjects(raycastTargets, false, intersects);

		if (intersects.length > 0) {
			const mesh = intersects[0].object;
			if (mesh.geometry == cubeGeometry) {
				hoveredSpace = new THREE.Vector3().addVectors(mesh.gamePosition, intersects[0].face.normal);
				if (!selectedPiece) {
					hoveredPiece = pieceAtGamePosition(hoveredSpace);
				} else {
					// could conflict with selecting moves that change the orientation
					// of a piece without moving outside of the space it occupies,
					// i.e. going up a wall
				}

				hoveredTowardsGroundVector = new THREE.Vector3();
				hoveredTowardsGroundVector.copy(intersects[0].face.normal);
				hoveredTowardsGroundVector.negate();
				console.assert(hoveredTowardsGroundVector.clone().round().equals(hoveredTowardsGroundVector), "might need round()");
			} else {
				hoveredPiece = mesh.parent.piece;
				hoveredSpace = hoveredPiece.gamePosition;

				hoveredTowardsGroundVector = hoveredPiece.towardsGroundVector;
			}
		}
	}

	let pointerCursor = false;
	if (hoveredPiece) {
		hoveredPiece.updateHovering(true);
		if (selectedPiece !== hoveredPiece) {
			pointerCursor = true;
		}
	}
	if (hoveredSpace) {
		hoverDecal.visible = true;
		const awayFromGroundVector = hoveredTowardsGroundVector.clone().negate();
		const decalWorldPosition = gameToWorldSpace(hoveredSpace.clone().add(hoveredTowardsGroundVector));
		positionDecalWorldSpace(hoverDecal, decalWorldPosition, awayFromGroundVector);
		// set the cursor if the square is a valid move
		if (selectedPiece) {
			const moves = getMoves(selectedPiece);
			const move = moves.find(move =>
				move.gamePosition.equals(hoveredSpace) &&
				move.towardsGroundVector.equals(hoveredTowardsGroundVector) &&
				move.valid
			);
			if (move && !gameOver) {
				pointerCursor = true;
			} else {
				const move = moves.find(move =>
					move.gamePosition.equals(hoveredSpace) &&
					move.towardsGroundVector.equals(hoveredTowardsGroundVector) &&
					!move.valid
				);
				if (move && move.checkMove) {
					const key = `${move.gamePosition.toArray()}`;
					if (!revealedAttackingPath[key]) {
						const path = makeMovePath(move.checkMove, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3, opacity: 0.2 }));
						scene.add(path);
						movementDecals.push(path);

						revealedAttackingPath[key] = true;
						playSound("reveal-attacking-path");
					}
				}
			}
		}
	} else if (hoveredPiece) {
		pointerCursor = true;
	}
	document.body.style.cursor = pointerCursor ? 'pointer' : 'default';

	renderer.render(scene, camera);
}

function cubeAtGamePosition(gamePosition) {
	const { x, y, z } = gamePosition;
	// if (x < 0 || y < 0 || z < 0) return false;
	// if (x >= BOARD_SIZE || y >= BOARD_SIZE || z >= BOARD_SIZE) return false;
	// return true;
	return cubesByGamePosition[`${x},${y},${z}`];
}
function pieceAtGamePosition(gamePosition) {
	return livingPieces.find((piece) => piece.gamePosition.equals(gamePosition));
}

function getMoves(piece, getPieceAtGamePosition = pieceAtGamePosition, checkingCheck = false) {
	const moves = [];
	const canGoManySpaces = ["queen", "rook", "bishop"].indexOf(piece.pieceType) !== -1;
	const movementDirections = [];
	if (piece.pieceType === "king" || piece.pieceType === "queen" || piece.pieceType === "rook") {
		// horizontal and vertical movement
		movementDirections.push([1, 0], [-1, 0], [0, 1], [0, -1]);
	}
	if (piece.pieceType === "king" || piece.pieceType === "queen" || piece.pieceType === "bishop") {
		// diagonal movement
		movementDirections.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
	}
	if (piece.pieceType === "knight") {
		// L-shaped movement
		movementDirections.push([1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]);
	}
	if (piece.pieceType === "pawn") {
		// one space forward, and for attacking, one space diagonally forward
		// Note: this forward direction must correspond to distanceForward!
		// movementDirections.push([1, 0], [1, 1], [1, -1]);
		movementDirections.push([0, -1], [1, -1], [-1, -1]);
		// on home cube face, move in any cardinal direction, and attack in any diagonal direction
		if (piece.gamePosition.z === piece.startingGamePosition.z) {
			// movementDirections.push(/*[1, 0],*/[-1, 0], [0, 1], [0, -1], /*[1, 1], [1, -1],*/[-1, 1], [-1, -1]);
			movementDirections.push([1, 0], [-1, 0], [0, 1], /*[0, -1],*/[1, 1], /*[1, -1],*/[-1, 1], /*[-1, -1]*/);
		}
	}
	for (const direction of movementDirections) {
		// a pawn can move two spaces if it is the first move the pawn makes
		// (don't do this as movementDirections.push([2, 0]) above because it needs collision detection)
		let maxSpaces = (canGoManySpaces ? BOARD_SIZE * 4 : 1);
		if (
			piece.pieceType === "pawn" &&
			piece.gamePosition.equals(piece.startingGamePosition) &&
			(direction[0] === 0 || direction[1] === 0) // straight movement
		) {
			maxSpaces = 2;
		}
		let pos = piece.gamePosition.clone();
		let lastPos = pos.clone();
		let towardsGroundVector = piece.towardsGroundVector.clone();
		// the orientation quaternion is gameplay-significant, for pawns,
		// since pawns can move only forwards (once they leave the home cube face)
		let quaternion = piece.gameOrientation.clone();
		// but we want it to start facing the direction of movement...
		// let quaternion = new THREE.Quaternion().setFromUnitVectors(
		// 	new THREE.Vector3(direction[0], 0, direction[1]),
		// 	towardsGroundVector,
		// )
		let keyframes = []; // for animating the piece's movement
		let distance = 0;
		keyframes.push({
			gamePosition: pos.clone(),
			orientation: quaternion.clone(),
		});
		for (let i = 1; i <= maxSpaces; i++) {
			// const debug = {};
			// sub-steps don't count for collision, i.e. the piece can jump over other pieces in a sub-step
			// TODO: pick best sub-step order for rook movement, avoiding collisions (just for animation)
			const subSteps = [];
			const xSubSteps = [];
			const ySubSteps = [];
			for (let x = 0; x < Math.abs(direction[0]); x++) {
				xSubSteps.push([Math.sign(direction[0]), 0]);
			}
			for (let y = 0; y < Math.abs(direction[1]); y++) {
				ySubSteps.push([0, Math.sign(direction[1])]);
			}
			if (Math.abs(direction[0]) > 1) {
				subSteps.push(...xSubSteps, ...ySubSteps);
			} else {
				subSteps.push(...ySubSteps, ...xSubSteps);
			}

			for (const subStep of subSteps) {
				// TODO: handle multiple new positions (e.g. a rook in a voxel world can either jump over a gap or wrap around a ledge)
				// (can use recursion to do this)

				// Note: applyQuaternion() gives imprecise results,
				// and breaks move equality checking when clicking to make a move,
				// especially with the Rook, if we don't round this.
				const subStep3D = new THREE.Vector3(subStep[0], 0, subStep[1]).applyQuaternion(quaternion).round();
				lastPos = pos.clone(); // not wanted for capturing? TODO: test

				// TODO: do this with Matrix4.lookAt() instead
				// const oldQuaternion = piece.object3d.quaternion.clone();
				// const oldPosition = piece.object3d.position.clone();
				// const oldUp = piece.object3d.up.clone(); // saving/restoring this might not be needed, but it feels dirty not to
				// // technically converting to world coordinates is not necessary, but again, it feels wrong not to
				// piece.object3d.position.copy(gameToWorldSpace(pos));
				// piece.object3d.up = towardsGroundVector.clone().negate();
				// piece.object3d.lookAt(gameToWorldSpace(pos.clone().add(subStep3D)));
				// // piece.object3d.lookAt(gameToWorldSpace(pos.clone().sub(subStep3D)));
				// // piece.object3d.lookAt(gameToWorldSpace(pos.clone().add(new THREE.Vector3(subStep[0], 0, subStep[1]))));
				// // piece.object3d.lookAt(new THREE.Vector3(subStep[0], 0, subStep[1]).applyQuaternion(quaternion).round());
				// quaternion.copy(piece.object3d.quaternion);
				// // quaternion./*pre*/multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
				// piece.object3d.quaternion.copy(oldQuaternion);
				// piece.object3d.position.copy(oldPosition);
				// piece.object3d.up.copy(oldUp);

				// Move forward. This may be backtracked if there's a wall.
				pos.add(subStep3D);

				// to avoid the piece sliding through the board,
				// add two keyframes where the piece is over the edge of the board,
				// one with the piece's current orientation,
				// and one with the piece's new orientation

				// and for rook movement, I might want it to move in an L shape,
				// but for other diagonal movement, I might want it to move diagonally

				const goingUpWall = cubeAtGamePosition(pos);
				const goingOverEdge = !cubeAtGamePosition(pos.clone().add(towardsGroundVector)) && !goingUpWall;
				const rookMovement = Math.abs(direction[0]) > 1 || Math.abs(direction[1]) > 1;

				if (goingUpWall) {
					// hit a wall; back up!
					pos.sub(subStep3D);
					// audit: shouldn't use subStep3D/subStep after this point (in actual execution)

					// and re-orient onto the wall
					quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(
						new THREE.Vector3(0, -1, 0),
						new THREE.Vector3(-subStep[0], 0, -subStep[1]),
					).conjugate());
					keyframes.push({
						gamePosition: pos.clone(),
						orientation: quaternion.clone(),
						goingUpWall,
					});
					lastPos = pos.clone();
					towardsGroundVector = new THREE.Vector3(0, -1, 0).applyQuaternion(quaternion).round();
				}

				if (goingOverEdge || rookMovement) {
					keyframes.push({
						gamePosition: pos.clone(),
						orientation: quaternion.clone(),
						goingOverEdge,
					});
				}

				if (goingOverEdge) {
					// and another keyframe with the new orientation
					// rotate the orientation over the ledge
					quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(
						new THREE.Vector3(0, -1, 0),
						new THREE.Vector3(-subStep[0], 0, -subStep[1]),
					));
					keyframes.push({
						gamePosition: pos.clone(),
						orientation: quaternion.clone(),
						goingOverEdge,
					});
					// move down off the edge of the board cube
					lastPos = pos.clone();
					pos.add(towardsGroundVector);
					towardsGroundVector = new THREE.Vector3().copy(subStep3D).negate().normalize();
				}

				// for the long part of a rook's movement,
				// add a keyframe so that the move path visualization doesn't go through the board cube,
				// and so that it displays consistently as an L shape and not a Y shape
				if (goingOverEdge && rookMovement) {
					keyframes.push({
						gamePosition: pos.clone(),
						orientation: quaternion.clone(),
					});
				}

				distance += 1;
			}

			// Face the piece forwards
			// Ideally this should happen earlier in the animation,
			// but I haven't managed to get it working where it
			// doesn't break the movement path, causing rooks for example to go in a winding path.
			// I'm storing and resetting the quaternion in order to avoid it affecting the path.
			const movement = new THREE.Vector3().subVectors(pos, lastPos);
			const resetQuaternion = quaternion.clone();
			if (movement.length() === 1) {
				const matrix = new THREE.Matrix4().lookAt(
					lastPos,
					pos,
					towardsGroundVector.clone().negate()
				);
				quaternion.setFromRotationMatrix(matrix);
			} else if (movement.length() != 0) {
				console.log("unexpected (but likely in the future)", movement, movement.length());
			} else {
				// TODO: use subStep3D instead of relying on lastPos-pos not being 0
				// and do this earlier in the animation,
				// in order to handle the case of a piece rotating onto a wall, occupying the same cell.
			}

			const pieceAtPos = getPieceAtGamePosition(pos);
			let capturingPiece = pieceAtPos;
			if (pieceAtPos && pieceAtPos.team === piece.team) {
				if (pieceAtPos === piece) {
					// reorienting a piece in the same space (going up a wall)
					capturingPiece = null;
				} else {
					// can't move onto a friendly piece
					break;
				}
			}
			keyframes.push({
				gamePosition: pos.clone(),
				orientation: quaternion.clone(),
				capturingPiece,
			});
			moves.push({
				piece: piece,
				gamePosition: pos.clone(),
				gameOrientation: quaternion.clone(),
				keyframes: [...keyframes], // make copy so each move has its own list of keyframes that ends with the final position
				towardsGroundVector, // technically redundant with gameOrientation
				direction,
				capturingPiece,
				distance,
				capturingDirectionVector: new THREE.Vector3().subVectors(pos, lastPos).normalize(),
				promotion: piece.pieceType === "pawn" && piece.distanceForward === 5, // distance will be incremented when taking the move, to 6, which is equivalent to the 8th rank
				// debug,
			});
			if (capturingPiece) {
				break;
			}
			// So subStep3D isn't calculated incorrectly, and rook/bishop/etc. paths are kept straight.
			quaternion.copy(resetQuaternion);
			// Avoid wiggling, by resetting the keyframe if it wasn't the final keyframe,
			// such that the piece only turns to face forwards at the end of the animation.
			keyframes[keyframes.length - 1] = {
				gamePosition: pos.clone(),
				orientation: resetQuaternion.clone(),
				capturingPiece,
			};
			// Need separate object instance, so we're not affecting the old one for moves less far along the path.
			// This would not work well:
			// keyframes[keyframes.length - 1].orientation = resetQuaternion.clone();
		}
	}
	// console.log(moves, piece.pieceType, movementDirections);
	for (const move of moves) {
		// TODO: generate more invalid moves? e.g. moving onto a friendly piece
		move.valid = true;
		if (move.piece.pieceType === "pawn") {
			if (move.direction[1] === 0 || move.direction[0] === 0) {
				if (move.capturingPiece) {
					move.valid = false;
				}
			} else if (!move.capturingPiece) {
				move.valid = false;
			}
		}
		if (!checkingCheck) { // avoid infinite recursion
			const check = wouldBeInCheck(move.piece.team, move.piece, move.gamePosition)
			if (check) {
				move.valid = false;
				move.checkMove = check;
			}
		}
	}
	moves.sort((a, b) => a.distance - b.distance);
	return moves;
}

function wouldBeInCheck(team, pieceToMove, targetGamePosition, boardPieces = livingPieces) {
	// check if any kings of pieceToMove's team would be attacked in the new world state
	// (if multiple kings are a thing, should only the last king be vital?)
	for (const otherPiece of boardPieces) {
		if (otherPiece.team !== team) {
			const getPieceAtGamePosition = (checkGamePosition) => {
				// Note: order of these ifs is important for case where a piece
				// moves but ends up occupying the same space it started in,
				// i.e. if it re-orients onto a wall.
				// Specifically, if the king is in check, merely reorienting the king should not be a valid move!
				// Otherwise it leads to what I'm calling "Assassin-Mate"

				// Pretend/suppose the piece is at the target position
				if (checkGamePosition.equals(targetGamePosition)) {
					return pieceToMove;
				}
				// and not where it is
				const pieceHere = pieceAtGamePosition(checkGamePosition);
				if (pieceHere === pieceToMove) {
					return null;
				}
				// otherwise the world state is the same
				return pieceHere;
			};
			if (otherPiece.gamePosition.equals(targetGamePosition)) {
				// this piece would be captured, ignore
				continue;
			}
			const moves = getMoves(otherPiece, getPieceAtGamePosition, true);
			for (const move of moves) {
				if (
					move.valid &&
					move.capturingPiece &&
					move.capturingPiece.pieceType === "king" &&
					move.capturingPiece.team === team
				) {
					return move;
				}
			}
		}
	}
	return null;
}

function isCurrentlyInCheck(team, boardPieces = livingPieces) {
	for (const otherPiece of boardPieces) {
		if (otherPiece.team !== team) {
			const moves = getMoves(otherPiece, pieceAtGamePosition, true);
			for (const move of moves) {
				if (
					move.valid &&
					move.capturingPiece &&
					move.capturingPiece.pieceType === "king" &&
					move.capturingPiece.team === team
				) {
					return true;
				}
			}
		}
	}
	return false;
}

const materialValues = {
	"king": 100,
	"queen": 20,
	"rook": 10,
	"bishop": 15,
	"knight": 5,
	"pawn": 1,
};
function judgeMove(move) {
	if (!move.valid) {
		return -1000;
	}
	// capturing
	let score = 0;
	if (move.capturingPiece) {
		score += materialValues[move.capturingPiece.pieceType];
	}
	// check (and sometimes checkmate!)
	if (wouldBeInCheck(+!move.piece.team, move.piece, move.gamePosition)) {
		score += 12;
	}
	// promotion
	if (move.piece.pieceType === "pawn") {
		score += (move.piece.distanceForward + 1) * 2;
	}
	return score;
}

let handleTurnTimerId;
function handleTurn() {
	const team = turn % 2;
	const inCheck = isCurrentlyInCheck(team);
	turnIndicator.textContent = turnMessages[team] + (inCheck ? " CHECK" : "");
	// console.log(`Turn ${turn} is ${teamNames[team]}'s turn (${teamTypes[team]})`);
	if (inCheck) {
		playSound("check");
	}
	clearTimeout(handleTurnTimerId);
	handleTurnTimerId = setTimeout(() => {
		let kinglessPuzzle = false;
		if (!livingPieces.some(piece => piece.team === team && piece.pieceType === "king")) {
			if (!livingPieces.some(piece => piece.team !== team && piece.pieceType === "king")) {
				kinglessPuzzle = true;
				turnIndicator.textContent += " [No Kings]";
			} else {
				// this should never happen in normal chess, but we're experimenting with weird chess variants, so...
				const winningTeam = +!team;
				turnIndicator.textContent = `Assassin-mate! ${teamNames[winningTeam]} wins!`
				gameOver = true;
				showGameOverDialog();
				if (teamTypes[team] === "computer") {
					playSound("win");
				} else if (teamTypes[(team + 1) % 2] === "computer") {
					playSound("lose");
				} else {
					playSound("checkmate");
				}
				return;
			}
		}

		const piecesToTry = livingPieces.filter(piece => piece.team === team);
		const moves = [];
		for (const piece of piecesToTry) {
			moves.push(...getMoves(piece).filter(move => move.valid));
		}
		shuffle(moves); // make the AI a little less predictable
		moves.sort((a, b) => a.distance - b.distance); // make AI more polite by taking shorter moves
		moves.sort((a, b) => judgeMove(b) - judgeMove(a));
		const move = moves[0];
		if (move) {
			if (teamTypes[team] === "computer") {
				move.piece.takeMove(move, handleTurn);
				turn++;
			}
			return;
		}
		if (!kinglessPuzzle) {
			gameOver = true;
			showGameOverDialog();
			if (inCheck) {
				const winningTeam = +!team;
				turnIndicator.textContent = `Checkmate! ${teamNames[winningTeam]} wins!`;
				if (teamTypes[team] === "computer") {
					playSound("win");
				} else if (teamTypes[(team + 1) % 2] === "computer") {
					playSound("lose");
				} else {
					playSound("checkmate");
				}
			} else {
				turnIndicator.textContent = "Stalemate! It's a draw.";
				playSound("draw");
			}
		}
	}, 500);
}

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

const gameSlugs = [
	"almost-chess",
	"chess-on-a-cube",
	"voxel-chess",
	"bio-chess",
	"mashup",
	"campaign",
];

const mainMenuEl = document.getElementById("main-menu");
const newGameOptionsEl = document.getElementById("new-game-options");
const leaveGameEl = document.getElementById("leave-game");
const backToMainEl = document.getElementById("back-to-main");
const startGameButton = document.getElementById("start-game");
const seedInput = document.getElementById("seed");
const worldSizeInput = document.getElementById("world-size");
const voxelChessOptions = document.getElementById("voxel-chess-options");
const gameOverDialog = document.getElementById("game-over-dialog");
const returnToMenuButton = document.getElementById("return-to-menu");
const reviewGameButton = document.getElementById("review-game");

function showGameOverDialog() {
	gameOverDialog.style.display = "";
	gameOverDialog.show();
}

returnToMenuButton.addEventListener("click", () => {
	location.hash = "#";
});
reviewGameButton.addEventListener("click", () => {
	gameOverDialog.close();
});

startGameButton.addEventListener("click", () => {
	location.hash = newGameOptionsEl.dataset.game;
});

function loadFromURL() {
	let game = "";
	let screen = "menu";
	for (const gameSlug of gameSlugs) {
		if (location.hash.match(new RegExp(`#${gameSlug}(/|$)`, "i"))) {
			game = gameSlug;
			if (location.hash.match(new RegExp(`#${gameSlug}/new-game`, "i"))) {
				screen = "new-game-options";
			} else {
				screen = game;
			}
		}
	}
	mainMenuEl.style.display = (screen === "menu") ? "" : "none";
	newGameOptionsEl.style.display = (screen === "new-game-options") ? "" : "none";
	backToMainEl.style.display = (screen === "new-game-options") ? "" : "none";
	voxelChessOptions.style.display = (screen === "new-game-options" && game === "voxel-chess") ? "" : "none";
	leaveGameEl.style.display = (screen === game) ? "" : "none";
	gameOverDialog.close();
	newGameOptionsEl.dataset.game = game;
	if (screen === game) {
		Math.seedrandom(seedInput.value || undefined);
		initWorld(game, Number(worldSizeInput.value) || BOARD_SIZE);
		setTeams(Number(document.querySelector("[name=players]:checked").value));
		handleTurn();
	}
}

window.addEventListener("hashchange", loadFromURL);
initRendering();
loadFromURL();
animate();
