
if (!Detector.webgl) Detector.addGetWebGLMessage();

const turnIndicator = document.getElementById("turn-indicator");

let container, stats,
	camera, controls,
	scene, renderer;
const raycastTargets = []; // don't want to include certain objects like hoverDecal, so we can't just use scene.children

let theme = "default";
try {
	theme = localStorage.getItem("3d-theme");
} catch (error) {
	console.warn("Couldn't read 3d-theme from local storage", error);
}

let cubeObject3D;
const allPieces = [];
const livingPieces = [];
const capturedPieces = [];
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
	roughness: 0.2,
	metalness: 0.1,
	transmission: 0.5,
	opacity: 0.8,
	transparent: true,
	envMap: reflectionTexture,
	envMapIntensity: 40,
	// map: marbleTexture,
});
let boardMat0 = new THREE.MeshPhysicalMaterial({
	color: color0,
	roughness: 0.2,
	metalness: 0.4,
	transmission: 0.5,
	opacity: 0.8,
	transparent: true,
	envMap: reflectionTexture,
	envMapIntensity: 40,
	// map: marbleTexture,
});

// const tarnishedBrass = new THREE.MeshPhysicalMaterial({
// 	color: 0xf0f0a0,
// 	// emissive: 0x333344,
// 	roughness: 0.1,
// 	metalness: 0.9,
// 	envMap: reflectionTexture,
// 	envMapIntensity: 10,
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
	envMapIntensity: 10,
});
let pieceMat0 = new THREE.MeshPhysicalMaterial({
	color: color0,
	// emissive: 0x3f3f3f,
	roughness: 0.2,
	metalness: 0.4,
	envMap: reflectionTexture,
	envMapIntensity: 10,
});

let hoveredPieceMat1 = new THREE.MeshPhysicalMaterial({
	color: color1,
	roughness: 0.01,
	metalness: 0.1,
	envMap: reflectionTexture,
	envMapIntensity: 100,
});
let hoveredPieceMat0 = new THREE.MeshPhysicalMaterial({
	color: color0,
	// emissive: 0x333344,
	roughness: 0.2,
	metalness: 0.3,
	envMap: reflectionTexture,
	envMapIntensity: 30,
});
const hoverDecalTexture = textureLoader.load('./textures/hover-decal-flower-frame-with-outline.png');

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
	color: 0xaaaaaa,
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
	color: 0xffaa00,
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
	return new THREE.Mesh(new THREE.PlaneBufferGeometry(squareSize, squareSize), material);
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
	const points = move.keyframes.map(
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
	return path;
}


const hoverDecal = makeDecal(hoverDecalMat);

const stlLoader = new THREE.STLLoader();
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
			geometry = THREE.BufferGeometryUtils.mergeVertices(geometry);
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

let teamTypes = ["human", "computer"];
let teamNames = ["White", "Red"];
let turnMessages = ["Your turn (White)", "Compu-turn (Red)"];
let turn = 0;
let gameOver = false;
let moveInProgress = false;
let raycaster;
const intersects = [];
let hoveredPiece;
let hoveredSpace;
let selectedPiece;
let movementDecals = [];
let spaceHoverDecals = [];

const mouse = { x: null, y: null };

function clearMovementDecals() {
	for (const decal of movementDecals) {
		scene.remove(decal);
	}
	movementDecals.length = 0;
}

addEventListener('mousemove', function (event) {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = 1 - (event.clientY / window.innerHeight) * 2;
}, true);

addEventListener('mousedown', function (event) {
	if (event.button !== 0) return;
	// console.log(`Clicked piece: ${hoveredPiece}`);
	if (hoveredPiece &&
		(
			(
				teamTypes[hoveredPiece.team] === "human" &&
				turn % 2 === hoveredPiece.team &&
				!moveInProgress
			) ||
			gameOver
		)
	) {
		selectedPiece = hoveredPiece;
		clearMovementDecals();
		const moves = getMoves(hoveredPiece);
		// console.log(moves);
		for (const move of moves) {
			const decal = makeDecal(move.valid ? validMoveDecalMat : invalidMoveDecalMat);
			const towardsGroundVector = getTowardsGroundVector(move.gamePosition);
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
			const moves = getMoves(selectedPiece);
			let move = moves.find(move => move.gamePosition.equals(hoveredSpace) && move.valid);
			if (event.ctrlKey) {
				// allow cheating with Ctrl-click
				move = {
					gamePosition: hoveredSpace,
					towardsGroundVector: getTowardsGroundVector(hoveredSpace),
					keyframes: [{
						gamePosition: hoveredSpace,
						towardsGroundVector: getTowardsGroundVector(hoveredSpace),
					}],
					piece: selectedPiece,
					valid: false,
					capturingPiece: pieceAtGamePosition(hoveredSpace),
					capturingDirectionVector: getTowardsGroundVector(hoveredSpace).clone().negate(), // fake
					direction: [1, 0], // fake
					distance: 1, // fake
				};
			}
			if (move) {
				selectedPiece.takeMove(move, takeTurn);
				turn++;
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

// function worldToGameSpace(worldPosition) {
// 	return worldPosition.clone().divideScalar(squareSize).floor();
// }
function gameToWorldSpace(gamePosition) {
	return gamePosition.clone().subScalar((BOARD_SIZE - 1) / 2).multiplyScalar(squareSize);
}

class Piece {
	constructor(x, y, z, team, pieceType) {
		this.startingGamePosition = new THREE.Vector3(x, y, z);
		this.gamePosition = this.startingGamePosition.clone();
		this.targetWorldPosition = gameToWorldSpace(this.gamePosition);
		this.targetOrientation = new THREE.Quaternion();
		this.towardsGroundVector = new THREE.Vector3();
		this.team = team;
		this.pieceType = pieceType || "pawn";
		this.object3d = new THREE.Object3D();
		this.defaultMaterial = team == 0 ? pieceMat0 : pieceMat1;
		this.hoverMaterial = team == 0 ? hoveredPieceMat0 : hoveredPieceMat1;
		const tempGeometry = new THREE.CylinderGeometry(10, 10, 30, 8, 1, false);
		const tempMesh = new THREE.Mesh(tempGeometry, this.defaultMaterial);
		this.object3d.add(tempMesh);
		// TODO: try leaving temp mesh in scene as a raycast target, but hide it
		this.raycastTarget = tempMesh;
		raycastTargets.push(this.raycastTarget);
		this.setPieceType(pieceType);
		this.object3d.position.copy(this.targetWorldPosition);
		this.orientTowardsCube(true);
		this.object3d.quaternion.copy(this.targetOrientation);
		scene.add(this.object3d);
		this.object3d.piece = this;
		this.distanceForward = 0; // used for pawn promotion
	}
	destroy() {
		scene.remove(this.object3d);
		raycastTargets.splice(raycastTargets.indexOf(this.raycastTarget), 1);
	}
	setPieceType(pieceType) {
		this.pieceType = pieceType;
		const index = pieceTypes.indexOf(this.pieceType);
		geometryPromises[Math.max(0, index)].then((geometry) => {
			const mesh = new THREE.Mesh(geometry, this.defaultMaterial);
			this.object3d.add(mesh);
			this.object3d.remove(this.raycastTarget);
			raycastTargets.splice(raycastTargets.indexOf(this.raycastTarget), 1);
			this.raycastTarget = mesh;
			raycastTargets.push(this.raycastTarget);
			mesh.rotation.x -= Math.PI / 2;
			mesh.position.y -= 15;
		});
	}
	takeMove(move, callback) {
		if (gameOver) {
			return;
		}
		if (moveInProgress) {
			return;
		}
		moveInProgress = true;

		const { capturingPiece } = move;
		if (capturingPiece) {
			// we will remove it from the scene after the animation!
			// update the game state immediately, so it's easier to implement consistent mechanics
			livingPieces.splice(livingPieces.indexOf(capturingPiece), 1);
			capturedPieces.push(capturingPiece);
		}

		this.distanceForward += move.direction[0]; // must correspond to pawn's forward direction!

		const path = makeMovePath(move);
		scene.add(path);

		this.gamePosition.copy(move.gamePosition);
		this.animating = true;
		let animIndex = 0;
		const iid = setInterval(() => {
			const { gamePosition, towardsGroundVector } = move.keyframes[animIndex];
			this.targetWorldPosition = gameToWorldSpace(gamePosition);
			this.targetOrientation.setFromUnitVectors(
				new THREE.Vector3(0, -1, 0),
				towardsGroundVector.clone(),
			);
			animIndex++;
			if (animIndex >= move.keyframes.length) {
				clearInterval(iid);
				// it hasn't quite stopped animating yet
				// there's still the transition to the final position
				setTimeout(() => {
					this.animating = false;
					moveInProgress = false;
					if (capturingPiece) {
						capturingPiece.destroy();
					}
					scene.remove(path);
					if (move.promotion) {
						this.setPieceType("queen"); // TODO: choice of piece type
					}
					callback();
				}, capturingPiece ? 1000 : 300);
			}
			// animate capturing as the piece moves into the final position
			if (capturingPiece && animIndex === move.keyframes.length - 1) {
				capturingPiece.beingCaptured = true;
				capturingPiece.targetWorldPosition.add(
					move.capturingDirectionVector.clone().multiplyScalar(squareSize),
				);
			}
		}, 300);

		this.orientTowardsCube(false);
	}
	orientTowardsCube(updateTargetOrientation = true) {
		this.towardsGroundVector.copy(getTowardsGroundVector(this.gamePosition));
		if (updateTargetOrientation) {
			this.targetOrientation.setFromUnitVectors(
				new THREE.Vector3(0, -1, 0),
				this.towardsGroundVector.clone(),
			);
		}
	}
	update() {
		const slowness = 10;
		this.object3d.position.x += (this.targetWorldPosition.x - this.object3d.position.x) / slowness;
		this.object3d.position.y += (this.targetWorldPosition.y - this.object3d.position.y) / slowness;
		this.object3d.position.z += (this.targetWorldPosition.z - this.object3d.position.z) / slowness;
		this.object3d.quaternion.slerp(this.targetOrientation, 1 / slowness);
		// this.object3d.quaternion.rotateTowards(this.targetOrientation, 0.05);
		// lift the piece up when selected, or when animating
		if (selectedPiece === this || this.animating) {
			// this.object3d.position.add(this.towardsGroundVector.clone().multiplyScalar(-0.5));

			const lift = new THREE.Vector3(0, 0.5, 0);
			lift.applyQuaternion(this.targetOrientation);
			this.object3d.position.add(lift);
		}
		// wiggle the piece gently when it's selected
		if (selectedPiece === this) {
			this.object3d.rotation.z += Math.sin(Date.now() / 500) / 150;
		}
		// capturing animation
		if (this.beingCaptured) {
			this.object3d.rotation.y -= 0.1;
			this.object3d.rotation.z -= 0.1;
			this.object3d.rotation.x -= 0.1;
			this.targetWorldPosition.add(this.towardsGroundVector.clone().multiplyScalar(-0.5));
			this.object3d.visible = Math.random() < 0.8;
		}
	}
	updateHovering(hovering) {
		const mesh = this.object3d.children[0];
		mesh.material = !hovering ? this.defaultMaterial : this.hoverMaterial;
	}
	toString() {
		const { x, y, z } = this.gamePosition;
		return `${teamNames[this.team]} ${this.pieceType} at (${x},${y},${z})`;
	}
}

function getTowardsGroundVector(gamePosition) {
	if (gamePosition.x < 0) {
		return new THREE.Vector3(1, 0, 0);
	} else if (gamePosition.y < 0) {
		return new THREE.Vector3(0, 1, 0);
	} else if (gamePosition.z < 0) {
		return new THREE.Vector3(0, 0, 1);
	} else if (gamePosition.x >= BOARD_SIZE) {
		return new THREE.Vector3(-1, 0, 0);
	} else if (gamePosition.y >= BOARD_SIZE) {
		return new THREE.Vector3(0, -1, 0);
	} else if (gamePosition.z >= BOARD_SIZE) {
		return new THREE.Vector3(0, 0, -1);
	} else {
		console.warn("Oh no, gamePosition is inside cube!");
		return new THREE.Vector3(0, 0, 1);
	}
}

function init() {

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.z = -500;
	camera.near = 0.1;
	camera.far = 1000;

	controls = new THREE.CubeControls(camera);
	controls.noPan = true; // panning already doesn't work but this makes it not give state === STATE.PANNING (with my modifications)

	scene = new THREE.Scene();
	// scene.fog = new THREE.FogExp2(0x000000, 0.002);

	if (theme === "wireframe" || theme === "perf") {
		scene.fog = new THREE.FogExp2(0x000000, 0.002);
	}

	raycaster = new THREE.Raycaster();

	// metacube
	cubeObject3D = new THREE.Object3D();
	for (let x = 0; x < BOARD_SIZE; x++) {
		for (let y = 0; y < BOARD_SIZE; y++) {
			for (let z = 0; z < BOARD_SIZE; z++) {
				const mesh = new THREE.Mesh(cubeGeometry, ((x + y + z) % 2) ? boardMat1 : boardMat0);
				mesh.visible = x === 0 || x === BOARD_SIZE - 1 || y === 0 || y === BOARD_SIZE - 1 || z === 0 || z === BOARD_SIZE - 1;
				mesh.gamePosition = new THREE.Vector3(x, y, z);
				mesh.position.copy(gameToWorldSpace(mesh.gamePosition));
				mesh.updateMatrix();
				mesh.matrixAutoUpdate = false;
				cubeObject3D.add(mesh);
				raycastTargets.push(mesh);
			}
		}
	}
	scene.add(cubeObject3D);
	scene.add(hoverDecal);

	// pieces
	const pieceLocations = [
		[1, 1],
		[1, BOARD_SIZE - 2],
		[BOARD_SIZE - 2, 1],
		[BOARD_SIZE - 2, BOARD_SIZE - 2],

		[2, 2],
		[2, BOARD_SIZE - 3],
		[BOARD_SIZE - 3, 2],
		[BOARD_SIZE - 3, BOARD_SIZE - 3],

		[3, 1],
		[1, BOARD_SIZE - 4],
		[BOARD_SIZE - 2, 3],
		[BOARD_SIZE - 4, BOARD_SIZE - 2],
	];
	for (let i in pieceLocations) {
		allPieces.push(new Piece(pieceLocations[i][0], pieceLocations[i][1], -1, 0, pieceTypes[i % 6]));
		allPieces.push(new Piece(pieceLocations[i][0], pieceLocations[i][1], BOARD_SIZE, 1, pieceTypes[i % 6]));
	}
	livingPieces.push(...allPieces);

	// lighting
	const ambientLight = new THREE.AmbientLight(0xeeeeee);
	scene.add(ambientLight);


	// renderer

	renderer = new THREE.WebGLRenderer({
		antialias: (theme === "wireframe" || theme === "perf") ? false : true
	});
	// renderer.setClearColor(scene.fog.color, 1);
	renderer.setSize(window.innerWidth, window.innerHeight);

	container = document.body;
	container.appendChild(renderer.domElement);

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild(stats.domElement);

	//

	window.addEventListener('resize', onWindowResize, false);

	// this texture can look really bad without anisotropic filtering
	// at an angle or from far away,
	// due to the black border around the white ornamentation
	const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
	hoverDecalTexture.anisotropy = maxAnisotropy;

}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
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

	// find hovered piece and/or board space and highlight it
	if (mouse.x != null && mouse.y != null && controls.state === controls.STATE.NONE) {
		raycaster.setFromCamera(mouse, camera);
		intersects.length = 0;
		raycaster.intersectObjects(raycastTargets, false, intersects);

		if (intersects.length > 0) {
			const mesh = intersects[0].object;
			// TODO: different behavior depending on state of the game? (selecting piece, moving piece)
			if (mesh.geometry == cubeGeometry) {
				// hoverDecal.visible = true;
				// positionDecalWorldSpace(hoverDecal, mesh.position, intersects[0].face.normal);
				hoveredSpace = new THREE.Vector3().addVectors(mesh.gamePosition, intersects[0].face.normal);
				hoveredPiece = pieceAtGamePosition(hoveredSpace);
			} else {
				hoveredPiece = mesh.parent.piece;
				hoveredSpace = hoveredPiece.gamePosition;
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
		// positionDecalWorldSpace(hoverDecal, mesh.position, intersects[0].face.normal);
		const towardsGroundVector = getTowardsGroundVector(hoveredSpace);
		const awayFromGroundVector = towardsGroundVector.clone().negate();
		const decalWorldPosition = gameToWorldSpace(hoveredSpace.clone().add(towardsGroundVector));
		positionDecalWorldSpace(hoverDecal, decalWorldPosition, awayFromGroundVector);
		// set the cursor if the square is a valid move
		if (selectedPiece) {
			const moves = getMoves(selectedPiece);
			const move = moves.find(move => move.gamePosition.equals(hoveredSpace) && move.valid);
			if (move && !gameOver) {
				pointerCursor = true;
			} else {
				const move = moves.find(move => move.gamePosition.equals(hoveredSpace) && !move.valid);
				if (move && move.checkMove) {
					const path = makeMovePath(move.checkMove, new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3, opacity: 0.2 }));
					scene.add(path);
					movementDecals.push(path);
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
	if (x < 0 || y < 0 || z < 0) return false;
	if (x >= BOARD_SIZE || y >= BOARD_SIZE || z >= BOARD_SIZE) return false;
	return true;
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
		movementDirections.push([1, 0], [1, 1], [1, -1]);
		// a pawn can move two spaces if it is the first move the pawn makes
		if (piece.gamePosition.equals(piece.startingGamePosition)) {
			movementDirections.push([2, 0]);
		}
	}
	for (const direction of movementDirections) {
		let pos = piece.gamePosition.clone();
		let lastPos = pos.clone();
		let towardsGroundVector = piece.towardsGroundVector.clone();
		let quaternion = piece.targetOrientation.clone();
		let keyframes = []; // for animating the piece's movement
		let distance = 0;
		keyframes.push({
			gamePosition: pos.clone(),
			towardsGroundVector: towardsGroundVector.clone()
		});
		for (let i = 1; i <= (canGoManySpaces ? BOARD_SIZE * 4 : 1); i++) {
			// sub-steps don't count for collision, i.e. the piece can jump over other pieces in a sub-step
			const subSteps = [];
			for (let x = 0; x < Math.abs(direction[0]); x++) {
				subSteps.push([Math.sign(direction[0]), 0]);
			}
			for (let y = 0; y < Math.abs(direction[1]); y++) {
				subSteps.push([0, Math.sign(direction[1])]);
			}

			for (const subStep of subSteps) {
				// TODO: handle multiple new positions (e.g. a rook in a voxel world can either jump over a gap or wrap around a ledge)
				// (can use recursion to do this)

				// Note: applyQuaternion() gives imprecise results,
				// and breaks move equality checking when clicking to make a move,
				// especially with the Rook, if we don't round this.
				const subStep3D = new THREE.Vector3(subStep[0], 0, subStep[1]).applyQuaternion(quaternion).round();
				// lastPos = pos.clone();
				pos.add(subStep3D);

				const diagonalMovement = Math.abs(direction[0]) === 1 && Math.abs(direction[1]) === 1;
				if (!diagonalMovement) {
					keyframes.push({
						gamePosition: pos.clone(),
						towardsGroundVector: towardsGroundVector.clone()
					});
				}

				// if there's no ground underneath the new position, wrap around the cube
				if (!cubeAtGamePosition(pos.clone().add(towardsGroundVector))) {
					// to avoid the piece sliding through the board,
					// add a keyframe where the piece is over the edge of the board
					if (diagonalMovement) { // (otherwise already added a keyframe)
						keyframes.push({
							gamePosition: pos.clone(),
							towardsGroundVector: towardsGroundVector.clone()
						});
					}
					// and another keyframe with the new orientation
					const newTowardsGroundVector = getTowardsGroundVector(pos.clone().add(towardsGroundVector));
					keyframes.push({
						gamePosition: pos.clone(),
						towardsGroundVector: newTowardsGroundVector,
					});
					// move down off the edge of the board cube
					lastPos = pos.clone();
					pos.add(towardsGroundVector);
					towardsGroundVector = getTowardsGroundVector(pos);
					quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(
						new THREE.Vector3(0, -1, 0),
						new THREE.Vector3(-subStep[0], 0, -subStep[1]),
					));
				}

				distance += 1;
			}

			const pieceAtPos = getPieceAtGamePosition(pos);
			if (pieceAtPos && pieceAtPos.team === piece.team) {
				// can't move onto a friendly piece
				break;
			}
			keyframes.push({
				gamePosition: pos.clone(),
				towardsGroundVector: towardsGroundVector.clone(),
				capturingPiece: pieceAtPos,
			});
			moves.push({
				piece: piece,
				gamePosition: pos.clone(),
				keyframes: [...keyframes], // make copy so each move has its own list of keyframes that ends with the final position
				towardsGroundVector,
				direction,
				capturingPiece: pieceAtPos,
				distance,
				capturingDirectionVector: new THREE.Vector3().subVectors(pos, lastPos).normalize(),
				promotion: piece.pieceType === "pawn" && piece.distanceForward === 5, // distance will be incremented when taking the move, to 6, which is equivalent to the 8th rank
			});
			if (pieceAtPos) {
				break;
			}
		}
	}
	// console.log(moves, piece.pieceType, movementDirections);
	for (const move of moves) {
		// TODO: generate more invalid moves? e.g. moving onto a friendly piece
		move.valid = true;
		if (move.piece.pieceType === "pawn") {
			if (move.direction[1] === 0) {
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
				// pretend the piece is at the target position
				const pieceHere = pieceAtGamePosition(checkGamePosition);
				if (pieceHere === pieceToMove) {
					return null;
				}
				if (checkGamePosition.equals(targetGamePosition)) {
					return pieceToMove;
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
	let score = 0;
	if (move.capturingPiece) {
		score += materialValues[move.capturingPiece.pieceType];
	}
	if (wouldBeInCheck(+!move.piece.team, move.piece, move.gamePosition)) {
		score += 12;
	}
	return score;
}


function takeTurn() {
	const team = turn % 2;
	const inCheck = isCurrentlyInCheck(team);
	turnIndicator.textContent = turnMessages[team] + (inCheck ? " CHECK" : "");
	// console.log(`Turn ${turn} is ${teamNames[team]}'s turn (${teamTypes[team]})`);
	setTimeout(() => {
		if (!livingPieces.some(piece => piece.team === team && piece.pieceType === "king")) {
			// this should never happen in normal chess, but we're experimenting with weird chess variants, so...
			const winningTeam = +!team;
			turnIndicator.textContent = `Assassin-mate! ${teamNames[winningTeam]} wins!`
			gameOver = true;
			return;
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
				move.piece.takeMove(move, takeTurn);
				turn++;
			}
			return;
		}
		gameOver = true;
		if (inCheck) {
			const winningTeam = +!team;
			turnIndicator.textContent = `Checkmate! ${teamNames[winningTeam]} wins!`;
		} else {
			turnIndicator.textContent = "Stalemate! It's a draw.";
		}
	}, 500);
}

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

init();
animate();
takeTurn();

