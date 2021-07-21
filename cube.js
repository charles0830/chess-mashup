
if (!Detector.webgl) Detector.addGetWebGLMessage();

let container, stats,
	camera, controls,
	scene, renderer;
const raycastTargets = []; // don't want to include certain objects like hoverDecal, so we can't just use scene.children

let theme = "default";
try {
	theme = localStorage.getItem("3d-theme");
} catch (e) {
	console.warn("Couldn't read 3d-theme from local storage");
}

let cubeObject3D;
const pieces = [];
let color1 = 0xaf0000;
let color2 = 0xffffff;

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
let boardMat2 = new THREE.MeshPhysicalMaterial({
	color: color2,
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
let pieceMat2 = new THREE.MeshPhysicalMaterial({
	color: color2,
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
let hoveredPieceMat2 = new THREE.MeshPhysicalMaterial({
	color: color2,
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
});
let validMoveDecalMat = new THREE.MeshStandardMaterial({
	color: 0xaaaaaa,
	emissive: 0x442200,
	transparent: true,
	opacity: 0.7,
	map: hoverDecalTexture,
	fog: false,
});
let invalidMoveDecalMat = new THREE.MeshStandardMaterial({
	color: 0xffaa00,
	emissive: 0x442200,
	transparent: true,
	opacity: 0.7,
	map: hoverDecalTexture,
	fog: false,
});

if (theme === "wireframe" || theme === "perf") {
	color1 = 0xffffff;
	color2 = 0xff0000;
	if (theme === "perf") {
		// boardMat1 = new THREE.MeshBasicMaterial({ color: "lime" });
		// boardMat2 = new THREE.MeshBasicMaterial({ color: "green" });
		boardMat1 = new THREE.MeshBasicMaterial({ color: 0xaa0000 });
		boardMat2 = new THREE.MeshBasicMaterial({ color: 0xcccccc });
	} else {
		boardMat1 = new THREE.MeshBasicMaterial({ color: "lime", wireframe: true });
		boardMat2 = new THREE.MeshBasicMaterial({ color: "green", wireframe: true });
		// boardMat1 = new THREE.MeshBasicMaterial({ color: "white", wireframe: true });
		// boardMat2 = new THREE.MeshBasicMaterial({ color: "black", wireframe: true });
	}
	pieceMat1 = new THREE.MeshBasicMaterial({ color: color1, wireframe: true });
	pieceMat2 = new THREE.MeshBasicMaterial({ color: color2, wireframe: true });
	hoveredPieceMat1 = new THREE.MeshBasicMaterial({ color: color1, wireframe: true, fog: false });
	hoveredPieceMat2 = new THREE.MeshBasicMaterial({ color: color2, wireframe: true, fog: false });
	hoverDecalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, fog: false });
	if (theme === "perf") {
		validMoveDecalMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true });
		invalidMoveDecalMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, opacity: 0.5, transparent: true });
	} else {
		validMoveDecalMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, fog: false });
		invalidMoveDecalMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: true, fog: false });
	}

}

function makeDecal(material) {
	return new THREE.Mesh(new THREE.PlaneBufferGeometry(squareSize, squareSize), material);
}
function positionDecalWorldSpace(decalMesh, worldPosition, faceNormal) {
	decalMesh.position.copy(worldPosition);
	decalMesh.position.add(faceNormal.clone().multiplyScalar(squareSize / 2 + 0.05));
	const axis = new THREE.Vector3(0, 0, 1);
	decalMesh.quaternion.setFromUnitVectors(axis, faceNormal);
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

const C = 8; // metacube board size in cubes/squares/cells

let turn = false;
let raycaster;
const intersects = [];
let hoveredPiece;
let hoveredSpace;
let selectedPiece;
let movementDecals = [];

const mouse = { x: null, y: null };

function clearMovementDecals() {
	for (const decal of movementDecals) {
		scene.remove(decal);
	}
	movementDecals.length = 0;
}

addEventListener('mousemove', function (e) {
	mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
	mouse.y = 1 - (e.clientY / window.innerHeight) * 2;
}, true);

addEventListener('mousedown', function (e) {
	if (e.button !== 0) return;
	if (hoveredPiece) {
		selectedPiece = hoveredPiece;
		clearMovementDecals();
		const moves = getMoves(hoveredPiece, hoveredSpace);
		console.log(moves);
		for (const move of moves) {
			const decal = makeDecal(move.valid ? validMoveDecalMat : invalidMoveDecalMat);
			const towardsGroundVector = getTowardsGroundVector(move.gamePosition);
			const awayFromGroundVector = towardsGroundVector.clone().negate();
			const decalWorldPosition = gameToWorldSpace(move.gamePosition.clone().add(towardsGroundVector));
			positionDecalWorldSpace(decal, decalWorldPosition, awayFromGroundVector);
			movementDecals.push(decal);
			scene.add(decal);
		}
	} else if (selectedPiece) {
		if (hoveredSpace) {
			selectedPiece.moveTo(hoveredSpace);
		}
		selectedPiece = null;
		clearMovementDecals();
	}
}, true);

addEventListener('mouseleave', function (e) {
	mouse.x = null;
	mouse.y = null;
}, true);

addEventListener('blur', function (e) {
	mouse.x = null;
	mouse.y = null;
}, true);

// function worldToGameSpace(worldPosition) {
// 	return worldPosition.clone().divideScalar(squareSize).floor();
// }
function gameToWorldSpace(gamePosition) {
	return gamePosition.clone().subScalar((C - 1) / 2).multiplyScalar(squareSize);
}

class Piece {
	constructor(x, y, z, team, pieceType) {
		this.gamePosition = new THREE.Vector3(x, y, z);
		this.targetWorldPosition = gameToWorldSpace(this.gamePosition);
		this.targetOrientation = new THREE.Quaternion();
		this.towardsGroundVector = new THREE.Vector3();
		this.team = team;
		this.pieceType = pieceType || "pawn";
		this.o = new THREE.Object3D();
		const mat = !team ? pieceMat1 : pieceMat2;
		const tempGeometry = new THREE.CylinderGeometry(10, 10, 30, 8, 1, false);
		const tempMesh = new THREE.Mesh(tempGeometry, mat);
		this.o.add(tempMesh);
		raycastTargets.push(tempMesh);
		geometryPromises[Math.max(0, pieceTypes.indexOf(this.pieceType))].then((geometry) => {
			const mesh = new THREE.Mesh(geometry, mat);
			this.o.add(mesh);
			this.o.remove(tempMesh);
			raycastTargets.push(mesh);
			raycastTargets.splice(raycastTargets.indexOf(tempMesh), 1);
			mesh.rotation.x -= Math.PI / 2;
			mesh.position.y -= 15;
		});
		this.o.position.copy(this.targetWorldPosition);
		this.orientTowardsCube();
		this.o.quaternion.copy(this.targetOrientation);
		scene.add(this.o);
		this.o.piece = this;
	}
	// TEMPORARY!
	get ox() {
		return this.towardsGroundVector.x;
	}
	get oy() {
		return this.towardsGroundVector.y;
	}
	get oz() {
		return this.towardsGroundVector.z;
	}
	get x() {
		return this.gamePosition.x;
	}
	get y() {
		return this.gamePosition.y;
	}
	get z() {
		return this.gamePosition.z;
	}
	moveTo(gamePosition) {
		if (pieceAtGamePosition(gamePosition))
			return false; // TODO: allow capturing

		this.gamePosition.copy(gamePosition);
		this.targetWorldPosition = gameToWorldSpace(this.gamePosition);

		this.orientTowardsCube();
		return true;
	}
	orientTowardsCube() {
		this.towardsGroundVector.copy(getTowardsGroundVector(this.gamePosition));
		this.targetOrientation.setFromUnitVectors(
			new THREE.Vector3(0, -1, 0),
			this.towardsGroundVector.clone(),
		);
	}
	update() {
		this.o.position.x += (this.targetWorldPosition.x - this.o.position.x) / 20;
		this.o.position.y += (this.targetWorldPosition.y - this.o.position.y) / 20;
		this.o.position.z += (this.targetWorldPosition.z - this.o.position.z) / 20;
		this.o.quaternion.slerp(this.targetOrientation, 1 / 20);
		// this.o.quaternion.rotateTowards(this.targetOrientation, 0.05);
		if (selectedPiece === this) {
			this.o.rotation.z += Math.sin(Date.now() / 500) / 150;
			this.o.position.add(this.towardsGroundVector.clone().multiplyScalar(-0.5));
		}
	}
	updateHovering(hovering) {
		const mesh = this.o.children[0];
		if (!this.team) {
			mesh.material = !hovering ? pieceMat1 : hoveredPieceMat1;
		} else {
			mesh.material = !hovering ? pieceMat2 : hoveredPieceMat2;
		}
	}
	toString() {
		return `${!this.team ? "Red" : "White"} ${this.pieceType} at (${this.x},${this.y},${this.z})`;
	}
}

function getTowardsGroundVector(gamePosition) {
	if (gamePosition.x < 0) {
		return new THREE.Vector3(1, 0, 0);
	} else if (gamePosition.y < 0) {
		return new THREE.Vector3(0, 1, 0);
	} else if (gamePosition.z < 0) {
		return new THREE.Vector3(0, 0, 1);
	} else if (gamePosition.x >= C) {
		return new THREE.Vector3(-1, 0, 0);
	} else if (gamePosition.y >= C) {
		return new THREE.Vector3(0, -1, 0);
	} else if (gamePosition.z >= C) {
		return new THREE.Vector3(0, 0, -1);
	} else {
		console.warn("Oh no, gamePosition is inside cube!");
		return new THREE.Vector3(0, 0, 1);
	}
}

function init() {

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.z = 500;
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
	for (let x = 0; x < C; x++) {
		for (let y = 0; y < C; y++) {
			for (let z = 0; z < C; z++) {
				const mesh = new THREE.Mesh(cubeGeometry, ((x + y + z) % 2) ? boardMat1 : boardMat2);
				mesh.visible = x === 0 || x === C - 1 || y === 0 || y === C - 1 || z === 0 || z === C - 1;
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
		[1, C - 2],
		[C - 2, 1],
		[C - 2, C - 2],

		[2, 2],
		[2, C - 3],
		[C - 3, 2],
		[C - 3, C - 3],

		[3, 1],
		[1, C - 4],
		[C - 2, 3],
		[C - 4, C - 2],
	];
	for (let i in pieceLocations) {
		pieces.push(new Piece(pieceLocations[i][0], pieceLocations[i][1], -1, 0, pieceTypes[i % 6]));
		pieces.push(new Piece(pieceLocations[i][0], pieceLocations[i][1], C, 1, pieceTypes[i % 6]));
	}

	// lighting
	const ambientLight = new THREE.AmbientLight(0xeeeeee);
	scene.add(ambientLight);


	// renderer

	renderer = new THREE.WebGLRenderer({
		antialias: theme === "wireframe" ? false : true
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

	for (let i = 0; i < pieces.length; i++) {
		pieces[i].update();
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
			const m = intersects[0].object;
			// TODO: hover space via piece or visa-versa, depending on state of the game (selecting piece, moving piece)
			if (m.geometry == cubeGeometry) {
				hoverDecal.visible = true;
				positionDecalWorldSpace(hoverDecal, m.position, intersects[0].face.normal);
				hoveredSpace = new THREE.Vector3().addVectors(m.gamePosition, intersects[0].face.normal);
			} else {
				hoveredPiece = m.parent.piece;
			}
		}
	}

	if (hoveredPiece) {
		hoveredPiece.updateHovering(true);
	}
	document.body.style.cursor = hoveredPiece ? 'pointer' : 'default';

	renderer.render(scene, camera);
}

function cubeAtGamePosition(gamePosition) {
	const { x, y, z } = gamePosition;
	if (x < 0 || y < 0 || z < 0) return false;
	if (x >= C || y >= C || z >= C) return false;
	return true;
}
function pieceAtGamePosition(gamePosition) {
	return pieces.find((piece) => piece.gamePosition.equals(gamePosition));
}

function get3DPositionsFrom2DRelativeMove(startingPos, towardsGroundVector, deltaX, deltaY) {
	if (deltaX === 0 && deltaY === 0)
		return [];
	// if (cubeAt(startingPos)) return [];
	let pos = startingPos.clone();
	if (towardsGroundVector.x === 0 && towardsGroundVector.y === 0) {
		pos.x += deltaX;
		pos.y += deltaY;
	} else if (towardsGroundVector.x === 0 && towardsGroundVector.z === 0) {
		pos.x += deltaX;
		pos.z += deltaY;
	} else if (towardsGroundVector.z === 0 && towardsGroundVector.y === 0) {
		pos.z += deltaX;
		pos.y += deltaY;
	} else {
		console.warn("Weird orientation...");
		return [];
	}

	// if there's no ground underneath the new position, wrap around the cube
	if (!cubeAtGamePosition(pos.clone().add(towardsGroundVector))) {
		// don't move diagonally off the edge of the board cube
		if (deltaX !== 0 && deltaY !== 0) {
			return [];
		}
		pos.add(towardsGroundVector);
	}

	return [pos];
}

function getMoves(piece) {
	const moves = [];
	const canGoManySpaces = ["queen", "rook", "bishop"].indexOf(piece.pieceType) !== -1;
	const movementDirections = [];
	if (piece.pieceType === "king" || piece.pieceType === "queen" || piece.pieceType === "rook") {
		movementDirections.push([1, 0], [-1, 0], [0, 1], [0, -1]);
	}
	if (piece.pieceType === "king" || piece.pieceType === "queen" || piece.pieceType === "bishop") {
		movementDirections.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
	}
	if (piece.pieceType === "knight") {
		movementDirections.push([1, 2], [1, -2], [-1, 2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]);
	}
	if (piece.pieceType === "pawn") {
		movementDirections.push([1, 0]);
		// TODO: a pawn can move two spaces if it is the first move
		// TODO: attack diagonally, and only move forward if there is no piece in the way
	}
	for (const direction of movementDirections) {
		let pos = piece.gamePosition.clone();
		let towardsGroundVector = piece.towardsGroundVector.clone();
		let positions = [];
		for (let i = 1; i <= (canGoManySpaces ? C - 1 : 1); i++) {
			const newPositions = get3DPositionsFrom2DRelativeMove(pos, towardsGroundVector, direction[0], direction[1]);
			// TODO: handle multiple new positions (e.g. a rook in a voxel world can either jump over a gap or wrap around a ledge)
			if (newPositions.length === 0) {
				break;
			}
			pos = newPositions[0];
			towardsGroundVector = getTowardsGroundVector(pos);
			positions.push(pos);
			moves.push({
				piece: piece,
				gamePosition: pos,
				gamePositions: positions,
				towardsGroundVector: towardsGroundVector,
			});
		}
	}
	// console.log(moves, piece.pieceType, movementDirections);
	for (const move of moves) {
		move.valid = true; // TODO: check if the move is valid
	}
	return moves;
}

function takeTurn() {
	//AI!
	turn = !turn;
	let timeout = 100;
	while (timeout--) {
		const piece = pieces[Math.floor(Math.random() * pieces.length)];
		if (piece.team == turn && Math.random() < 4) {
			const moves = getMoves(piece);
			shuffle(moves);
			for (const move of moves) {
				if (move.valid) {
					if (piece.moveTo(move.gamePosition)) {
						return true;
					}
				}
			}
		}
	}
	console.log("Couldn't find move.");
	return false;

	function r() {
		return Math.floor(Math.random() * 3) - 1;
	}
}

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

init();
animate();
setTimeout(() => {
	setInterval(takeTurn, 1000);
}, 5000);
