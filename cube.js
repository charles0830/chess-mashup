
if (!Detector.webgl) Detector.addGetWebGLMessage();

var container, stats,
	camera, controls,
	scene, renderer;
var raycastTargets = []; // don't want to include certain objects like hoverDecal, so we can't just use scene.children

var cubes = [];
var cubeObject3D;
var pieces = [];
var col1 = 0xaf0000;
var col2 = 0xffffff;

var squareSize = 30;
var cube = new THREE.BoxGeometry(squareSize, squareSize, squareSize);

const textureLoader = new THREE.TextureLoader();

// const marbleTexture = textureLoader.load("textures/Seamless-White-Marble-Texture.webp");

var reflectionTexture = textureLoader.load('textures/2294472375_24a3b8ef46_o.jpg');
reflectionTexture.mapping = THREE.EquirectangularReflectionMapping;
reflectionTexture.encoding = THREE.sRGBEncoding;

/*var material1 = new THREE.MeshLambertMaterial({
	map: THREE.ImageUtils.loadTexture('/marble2.jpg'),
	color:col1, ambient:col1, opacity: 0.7, transparent: true
});
var material2 = new THREE.MeshLambertMaterial({
	map: THREE.ImageUtils.loadTexture('/marble1'),
	color:col2, ambient:col2, opacity: 0.7, transparent: true
});*/
var boardMat1 = new THREE.MeshPhysicalMaterial({
	color: col1,
	roughness: 0.2,
	metalness: 0.1,
	transmission: 0.5,
	opacity: 0.8,
	transparent: true,
	envMap: reflectionTexture,
	envMapIntensity: 40,
	// map: marbleTexture,
});
var boardMat2 = new THREE.MeshPhysicalMaterial({
	color: col2,
	roughness: 0.2,
	metalness: 0.4,
	transmission: 0.5,
	opacity: 0.8,
	transparent: true,
	envMap: reflectionTexture,
	envMapIntensity: 40,
	// map: marbleTexture,
});

// var pieceMat1 = new THREE.MeshLambertMaterial({
// 	color: 0xffffff,
// 	emissive: 0xd48a8a,
// 	ambient: col1,
// 	shading: THREE.SmoothShading,
// 	shininess: 100.0,
// 	specular: 0xfbbbbb,
// 	map: textureLoader.load('./Seamless-White-Marble-Texture.webp'),
// });
var pieceMat1 = new THREE.MeshPhysicalMaterial({
	color: col1,
	roughness: 0.2,
	metalness: 0.4,
	envMap: reflectionTexture,
	envMapIntensity: 10,
});
var pieceMat2 = new THREE.MeshPhysicalMaterial({
	color: col2,
	// emissive: 0x3f3f3f,
	roughness: 0.2,
	metalness: 0.4,
	envMap: reflectionTexture,
	envMapIntensity: 10,
});

// var hoveredBoardMat1 = boardMat1.clone(); hoveredBoardMat1.emissive.add(new THREE.Color(0x000000));
// var hoveredBoardMat2 = boardMat2.clone(); hoveredBoardMat2.emissive.add(new THREE.Color(0x000000));
var hoveredPieceMat1 = pieceMat1.clone(); hoveredPieceMat1.emissive.add(new THREE.Color(0x993333));
var hoveredPieceMat2 = pieceMat2.clone(); hoveredPieceMat2.emissive.add(new THREE.Color(0x333344));
var hoverDecalMat = new THREE.MeshStandardMaterial({
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

var hoverDecal;

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
		resolve, // Success callback
		(xhr) => {
			// Progress callback
		},
		(xhr) => {
			// Failure callback
			// Reject the promise with the failure
			reject(new Error('Could not load ' + url));
		}
	);
}));

var C = 8; // metacube board size in cubes/squares/cells

var turn = false;
var raycaster;
var intersects = [];
var hoveredPiece;
var hoveredSpace;
var selectedPiece;

var mouse = { x: null, y: null };

addEventListener('mousemove', function (e) {
	mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
	mouse.y = 1 - (e.clientY / window.innerHeight) * 2;
}, true);

addEventListener('mousedown', function (e) {
	if (e.button !== 0) return;
	if (hoveredPiece) {
		console.log(hoveredPiece + "");
		// hoveredPiece.lift();
		selectedPiece = hoveredPiece;
	} else if (selectedPiece) {
		if (hoveredSpace) {
			selectedPiece.moveTo(hoveredSpace.x, hoveredSpace.y, hoveredSpace.z);
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

function worldToGameSpace(worldPosition) {
	return worldPosition.clone().divide(squareSize).floor();
}
function gameToWorldSpace(gamePosition) {
	// return gamePosition.clone().multiply(squareSize);//.add(new THREE.Vector3(0.5, 0.5, 0.5));
	return new THREE.Vector3(
		(gamePosition.x - (C - 1) / 2) * squareSize,
		(gamePosition.y - (C - 1) / 2) * squareSize,
		(gamePosition.z - (C - 1) / 2) * squareSize
	);
}

class Piece {
	constructor(x, y, z, team, pieceType) {
		this.gamePosition = new THREE.Vector3(x, y, z);
		this.targetWorldPosition = gameToWorldSpace(this.gamePosition);
		// this.targetOrientation = new THREE.Quaternion();
		this.towardsGroundVector = new THREE.Vector3();
		this.smoothedTowardsGroundVector = new THREE.Vector3();
		this.team = team;
		this.pieceType = pieceType || "pawn";
		this.o = new THREE.Object3D();
		var mat = !team ? pieceMat1 : pieceMat2;
		var tempGeometry = new THREE.CylinderGeometry(11, 10, 2, 15, 1, false);
		var tempMesh = new THREE.Mesh(tempGeometry, mat);
		this.o.add(tempMesh);
		raycastTargets.push(tempMesh);
		geometryPromises[Math.max(0, pieceTypes.indexOf(this.pieceType))].then((geometry) => {
			var mesh = new THREE.Mesh(geometry, mat);
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
	moveRelative2D(mx, my) {
		if (mx === 0 && my === 0)
			return false;
		//if(cubeAt(x,y,z))return false;
		var x, y, z;
		if (this.ox === 0 && this.oy === 0) {
			z = this.z;
			x = this.x + mx;
			y = this.y + my;
		} else if (this.ox === 0 && this.oz === 0) {
			y = this.y;
			x = this.x + mx;
			z = this.z + my;
		} else if (this.oz === 0 && this.oy === 0) {
			x = this.x;
			z = this.z + mx;
			y = this.y + my;
		} else {
			console.warn("Weird orientation...");
			return false;
		}

		// if there's no ground underneath the new position, wrap around the cube
		// (ox/oy/oz are orientation)
		if (!cubeAt(x + this.ox, y + this.oy, z + this.oz)) {
			// don't move diagonally off the edge of the board cube
			if (mx !== 0 && my !== 0) {
				return false;
			}
			x += this.ox;
			y += this.oy;
			z += this.oz;
			//this.rx += mx * Math.PI/2;
			//this.rz -= my * Math.PI/2;
		}

		return this.moveTo(x, y, z);
	}
	moveTo(x, y, z) {
		if (pieceAt(x, y, z))
			return false; // TODO: allow capturing

		this.gamePosition.set(x, y, z);
		this.targetWorldPosition = gameToWorldSpace(this.gamePosition);

		this.orientTowardsCube();
		return true;
	}
	orientTowardsCube() {
		if (this.x < 0) {
			// this.ox = 1, this.oy = 0, this.oz = 0;
			this.towardsGroundVector.set(1, 0, 0);
		} else if (this.y < 0) {
			// this.oy = 1, this.ox = 0, this.oz = 0;
			this.towardsGroundVector.set(0, 1, 0);
		} else if (this.z < 0) {
			// this.oz = 1, this.oy = 0, this.ox = 0;
			this.towardsGroundVector.set(0, 0, 1);
		} else if (this.x >= C) {
			// this.ox = -1, this.oy = 0, this.oz = 0;
			this.towardsGroundVector.set(-1, 0, 0);
		} else if (this.y >= C) {
			// this.oy = -1, this.ox = 0, this.oz = 0;
			this.towardsGroundVector.set(0, -1, 0);
		} else if (this.z >= C) {
			// this.oz = -1, this.oy = 0, this.ox = 0;
			this.towardsGroundVector.set(0, 0, -1);
		} else {
			console.warn("Weird! IDK!");
		}
	}
	// lift () {
	// }
	update() {
		//console.log(this.px,this.o.rotation.z);
		/*this.o.position.x = this.px;
		this.o.rotation.z = this.rz+Math.sin(Date.now()/500)/5;*/
		this.o.position.x += (this.targetWorldPosition.x - this.o.position.x) / 20;
		this.o.position.y += (this.targetWorldPosition.y - this.o.position.y) / 20;
		this.o.position.z += (this.targetWorldPosition.z - this.o.position.z) / 20;
		// this.o.rotation.x += (this.rx - this.o.rotation.x) / 20;
		// this.o.rotation.y += (this.ry - this.o.rotation.y) / 20;
		// this.o.rotation.z += (this.rz - this.o.rotation.z) / 20;
		// this.smoothedTowardsGroundVector.add(this.towardsGroundVector.clone().sub(this.towardsGroundVector).multiplyScalar(0.1));
		this.smoothedTowardsGroundVector.x += (this.towardsGroundVector.x - this.smoothedTowardsGroundVector.x) / 20;
		this.smoothedTowardsGroundVector.y += (this.towardsGroundVector.y - this.smoothedTowardsGroundVector.y) / 20;
		this.smoothedTowardsGroundVector.z += (this.towardsGroundVector.z - this.smoothedTowardsGroundVector.z) / 20;
		var axis = new THREE.Vector3(0, -1, 0);
		this.o.quaternion.setFromUnitVectors(axis, this.smoothedTowardsGroundVector);
		// this.o.quaternion.setFromUnitVectors(axis, this.towardsGroundVector);
		if (selectedPiece === this) {
			this.o.rotation.z += Math.sin(Date.now() / 500) / 150;
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
	for (var x = 0; x < C; x++) {
		cubes[x] = [];
		for (var y = 0; y < C; y++) {
			cubes[x][y] = [];
			for (var z = 0; z < C; z++) {
				var mesh = new THREE.Mesh(cube, ((x + y + z) % 2) ? boardMat1 : boardMat2);
				mesh.position.x = (x - C / 2 + 0.5) * squareSize;
				mesh.position.y = (y - C / 2 + 0.5) * squareSize;
				mesh.position.z = (z - C / 2 + 0.5) * squareSize;
				mesh.updateMatrix();
				mesh.matrixAutoUpdate = false;
				cubeObject3D.add(mesh);
				cubes[x][y][z] = mesh;
				mesh.cubeX = x;
				mesh.cubeY = y;
				mesh.cubeZ = z;
				raycastTargets.push(mesh);
			}
		}
	}
	scene.add(cubeObject3D);
	hoverDecal = new THREE.Mesh(new THREE.PlaneBufferGeometry(squareSize, squareSize), hoverDecalMat);
	scene.add(hoverDecal);
	//pieces
	var pieceLocations = [
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
	for (i in pieceLocations) {
		pieces.push(new Piece(pieceLocations[i][0], pieceLocations[i][1], -1, 0, pieceTypes[i % 6]));
		pieces.push(new Piece(pieceLocations[i][0], pieceLocations[i][1], C, 1, pieceTypes[i % 6]));
	}

	// lighting

	// light = new THREE.DirectionalLight(0x112113);
	// light.position.set(15, 52, 16);
	// scene.add(light);

	// light = new THREE.DirectionalLight(0x111121);
	// light.position.set(15, 16, 52);
	// scene.add(light);

	// light = new THREE.DirectionalLight(0x111112);
	// light.position.set(-52, -15, -16);
	// scene.add(light);

	// light = new THREE.DirectionalLight(0x111211);
	// light.position.set(-52, 15, -76);
	// scene.add(light);

	light = new THREE.AmbientLight(0xeeeeee);
	scene.add(light);


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
}

function animate() {
	requestAnimationFrame(animate);
	stats.update();

	for (var i = 0; i < pieces.length; i++) {
		pieces[i].update();
	}
	controls.update();

	// clear hover state of previously hovered piece
	if (hoveredPiece) {
		for (i = 0; i < hoveredPiece.o.children.length; i++) {
			updateMaterial(hoveredPiece.o.children[i], false);
		}
		hoveredPiece.hovering = false;
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
			var m = intersects[0].object;
			// TODO: hover space via piece or visa-versa, depending on state of the game (selecting piece, moving piece)
			if (m.geometry == cube) {
				// console.log("cube at ("+o3.x+","+o3.y+","+o3.z+")");
				hoverDecal.visible = true;
				hoverDecal.position.copy(m.position);
				hoverDecal.position.add(intersects[0].face.normal.clone().multiplyScalar(squareSize / 2 + 0.01));
				var axis = new THREE.Vector3(0, 0, 1);
				hoverDecal.quaternion.setFromUnitVectors(axis, intersects[0].face.normal);
				if (m.material === boardMat1) {
					// hoverDecalMat.emissive.set(0xffffcc);
					// hoverDecalMat.emissive.set(0xffccaa);
				} else {
					// hoverDecalMat.emissive.set(0x220000);
					// hoverDecalMat.emissive.set(0xffffff);
				}
				// hoveredSpace = m.position.clone().divideScalar(squareSize).add(intersects[0].face.normal);
				// hoveredSpace = m.position.clone().divideScalar(squareSize).floor();
				hoveredSpace = new THREE.Vector3(m.cubeX, m.cubeY, m.cubeZ).add(intersects[0].face.normal);
			} else {
				hoveredPiece = m.parent.piece;
			}
		}
	}

	if (hoveredPiece) {
		for (i = 0; i < hoveredPiece.o.children.length; i++) {
			updateMaterial(hoveredPiece.o.children[i], true);
		}
		hoveredPiece.hovering = true;
	}
	document.body.style.cursor = hoveredPiece ? 'pointer' : 'default';

	renderer.render(scene, camera);
}


function updateMaterial(m, hovering) {
	if (m.geometry == cube) {
		// using a decal instead
		// if (m.material == boardMat1 || m.material == hoveredBoardMat1) {
		// 	m.material = !hovering ? boardMat1 : hoveredBoardMat1;
		// } else {
		// 	m.material = !hovering ? boardMat2 : hoveredBoardMat2;
		// }
	} else {
		if (m.material == pieceMat1 || m.material == hoveredPieceMat1) {
			m.material = !hovering ? pieceMat1 : hoveredPieceMat1;
		} else {
			m.material = !hovering ? pieceMat2 : hoveredPieceMat2;
		}
	}
}

function cubeAt(x, y, z) {
	if (x < 0 || y < 0 || z < 0) return false;
	if (x >= C || y >= C || z >= C) return false;
	return true;
	//return cubes[x][y][z];
}
function pieceAt(x, y, z) {
	for (var i = 0; i < pieces.length; i++) {
		if (pieces[i].x == x && pieces[i].y == y && pieces[i].z == z) {
			return true;
		}
	}
	return false;
}

function takeTurn() {
	//AI!
	turn = !turn;
	var timeout = 100;
	while (timeout--) {
		var p = pieces[Math.floor(Math.random() * pieces.length)];
		if (p.team == turn && Math.random() < 4) {
			if (p.moveRelative2D(r(), r())) {
				return true;
			}
		}
	}
	console.log("Couldn't find move.");
	return false;

	function r() {
		return Math.floor(Math.random() * 3) - 1;
	}
}

init();
animate();
setTimeout(() => {
	setInterval(takeTurn, 1000);
}, 5000);
