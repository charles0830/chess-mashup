
if (!Detector.webgl) Detector.addGetWebGLMessage();

let container, stats,
	camera, controls,
	scene, renderer;
const raycastTargets = []; // don't want to include certain objects like hoverDecal, so we can't just use scene.children

let cubeObject3D;
const pieces = [];
const color1 = 0xaf0000;
const color2 = 0xffffff;

const squareSize = 30;
const cubeGeometry = new THREE.BoxGeometry(squareSize, squareSize, squareSize);

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
const boardMat1 = new THREE.MeshPhysicalMaterial({
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
const boardMat2 = new THREE.MeshPhysicalMaterial({
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

// const pieceMat1 = new THREE.MeshLambertMaterial({
// 	color: 0xffffff,
// 	emissive: 0xd48a8a,
// 	ambient: color1,
// 	shininess: 1.0,
// 	specular: 0xfbbbbb,
// 	// map: textureLoader.load('./Seamless-White-Marble-Texture.webp'),
// 	envMap: reflectionTexture,
// });
const pieceMat1 = new THREE.MeshPhysicalMaterial({
	color: color1,
	roughness: 0.01,
	metalness: 0.5,
	envMap: reflectionTexture,
	envMapIntensity: 10,
});
const pieceMat2 = new THREE.MeshPhysicalMaterial({
	color: color2,
	// emissive: 0x3f3f3f,
	roughness: 0.2,
	metalness: 0.4,
	envMap: reflectionTexture,
	envMapIntensity: 10,
});

// const hoveredBoardMat1 = boardMat1.clone(); hoveredBoardMat1.emissive.add(new THREE.Color(0x000000));
// const hoveredBoardMat2 = boardMat2.clone(); hoveredBoardMat2.emissive.add(new THREE.Color(0x000000));
const hoveredPieceMat1 = new THREE.MeshPhysicalMaterial({
	color: color1,
	roughness: 0.01,
	metalness: 0.1,
	envMap: reflectionTexture,
	envMapIntensity: 100,
});
const hoveredPieceMat2 = //pieceMat2.clone(); hoveredPieceMat2.emissive.add(new THREE.Color(0x333344));
new THREE.MeshPhysicalMaterial({
	color: color2,
	// emissive: 0x333344,
	roughness: 0.2,
	metalness: 0.3,
	envMap: reflectionTexture,
	envMapIntensity: 30,
});
const hoverDecalMat = new THREE.MeshStandardMaterial({
	color: 0xffffff,
	emissive: 0x442200,
	transparent: true,
	// map: textureLoader.load('./textures/vintage-symmetric-frame-extrapolated.png'), // too high detail
	// alphaMap: textureLoader.load('./textures/symmetric-checkerboard-frame.jpg'), // funny
	// alphaMap: textureLoader.load('./textures/flower-frame-1436652825nLe.jpg'),
	map: textureLoader.load('./textures/hover-decal-flower-frame-with-outline.png'), // outline for contrast... but from far away it looks bad and reduces contrast!
	// depthTest: false,
	// depthWrite: false,
	// combine: THREE.MultiplyOperation,
});

const hoverDecal = new THREE.Mesh(new THREE.PlaneBufferGeometry(squareSize, squareSize), hoverDecalMat);

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

const mouse = { x: null, y: null };

addEventListener('mousemove', function (e) {
	mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
	mouse.y = 1 - (e.clientY / window.innerHeight) * 2;
}, true);

addEventListener('mousedown', function (e) {
	if (e.button !== 0) return;
	if (hoveredPiece) {
		selectedPiece = hoveredPiece;
	} else if (selectedPiece) {
		if (hoveredSpace) {
			selectedPiece.moveTo(hoveredSpace);
		}
		selectedPiece = null;
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
		const tempGeometry = new THREE.CylinderGeometry(10, 10, 30, 15, 1, false);
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
		if (this.x < 0) {
			this.towardsGroundVector.set(1, 0, 0);
		} else if (this.y < 0) {
			this.towardsGroundVector.set(0, 1, 0);
		} else if (this.z < 0) {
			this.towardsGroundVector.set(0, 0, 1);
		} else if (this.x >= C) {
			this.towardsGroundVector.set(-1, 0, 0);
		} else if (this.y >= C) {
			this.towardsGroundVector.set(0, -1, 0);
		} else if (this.z >= C) {
			this.towardsGroundVector.set(0, 0, -1);
		} else {
			console.warn("Oh no, piece is inside cube!");
		}
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

function init() {

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.z = 500;
	camera.near = 0.1;
	camera.far = 1000;

	controls = new THREE.CubeControls(camera);
	controls.noPan = true; // panning already doesn't work but this makes it not give state === STATE.PANNING (with my modifications)

	scene = new THREE.Scene();
	// scene.fog = new THREE.FogExp2(0x000000, 0.002);

	let theme = "default";
	try {
		theme = localStorage.getItem("3d-theme");
	} catch (e) {
		console.warn("Couldn't read 3d-theme from local storage");
	}
	if (theme === "wireframe") {
		scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: "lime", wireframe: true })
		scene.fog = new THREE.FogExp2(0x000000, 0.003);
	}

	raycaster = new THREE.Raycaster();

	// metacube
	cubeObject3D = new THREE.Object3D();
	for (let x = 0; x < C; x++) {
		for (let y = 0; y < C; y++) {
			for (let z = 0; z < C; z++) {
				const mesh = new THREE.Mesh(cubeGeometry, ((x + y + z) % 2) ? boardMat1 : boardMat2);
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

	renderer = new THREE.WebGLRenderer();
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
				hoverDecal.position.copy(m.position);
				hoverDecal.position.add(intersects[0].face.normal.clone().multiplyScalar(squareSize / 2 + 0.01));
				const axis = new THREE.Vector3(0, 0, 1);
				hoverDecal.quaternion.setFromUnitVectors(axis, intersects[0].face.normal);
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

function getMoves2D(piece) {
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
		movementDirections.push([2, 1], [2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]);
	}
	if (piece.pieceType === "pawn") {
		movementDirections.push([1, 0]);
		// TODO: a pawn can move two spaces if it is the first move
		// TODO: attack diagonally, and only move forward if there is no piece in the way
	}
	for (let jump = 1; jump <= (canGoManySpaces ? C - 1 : 1); jump++) {
		for (const direction of movementDirections) {
			moves.push(direction.map(coord => coord * jump));
		}
	}
	// console.log(moves, piece.pieceType, movementDirections	);
	// for (const move of moves) {
	// 	move.valid = true;
	// }
	return moves;
}

function takeTurn() {
	//AI!
	turn = !turn;
	let timeout = 100;
	while (timeout--) {
		const piece = pieces[Math.floor(Math.random() * pieces.length)];
		if (piece.team == turn && Math.random() < 4) {
			const moves = getMoves2D(piece);
			shuffle(moves);
			for (const move of moves) {
				const newPositions = get3DPositionsFrom2DRelativeMove(piece.gamePosition, piece.towardsGroundVector, move[0], move[1]);
				shuffle(newPositions);
				for (const newPosition of newPositions) {
					if (piece.moveTo(newPosition)) {
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
