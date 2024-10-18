// Setup basic scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set the background color of the scene
renderer.setClearColor(0x87CEEB, 1); // Sky blue color

// Textures
const grassTexture = new THREE.TextureLoader().load('textures/grass.png');
const treeTexture = new THREE.TextureLoader().load('textures/tree.png');
const waterTexture = new THREE.TextureLoader().load('textures/water.png');

// Inventory
const inventory = [];

// Constants for chunk-based world generation
const chunkSize = 16;
let currentChunk = { x: 0, z: 0 };
const loadedChunks = new Set();

// Block-breaking logic
const blockBreakingCrackTexture = new THREE.TextureLoader().load('textures/crack.png');

// Function to create a block
function createBlock(x, y, z, texture) {
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x * blockSize, y * blockSize, z * blockSize);
    scene.add(block);
    return block;
}

// Function to create a tree (square leaves)
function createTree(x, y, z) {
    // Trunk
    for (let i = 0; i < 3; i++) {
        createBlock(x, y + i, z, treeTexture);
    }

    // Leaves (square-shaped, like everything else)
    for (let i = -1; i <= 1; i++) {
        for (let j = 3; j <= 4; j++) {
            for (let k = -1; k <= 1; k++) {
                if (i !== 0 || j !== 3 || k !== 0) { // Leave the center top block empty
                    createBlock(x + i, y + j, z + k, grassTexture); // Using grass texture for leaves
                }
            }
        }
    }
}

// Function to fill water in empty spaces
function fillWithWater(x, z) {
    for (let y = -5; y < 0; y++) { // Fill water from y = -5 to y = 0
        createBlock(x, y, z, waterTexture);
    }
}

// Function to generate a chunk
function generateChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    if (loadedChunks.has(chunkKey)) return; // Don't generate the same chunk twice
    loadedChunks.add(chunkKey);

    for (let x = chunkX * chunkSize; x < (chunkX + 1) * chunkSize; x++) {
        for (let z = chunkZ * chunkSize; z < (chunkZ + 1) * chunkSize; z++) {
            const height = Math.floor(simplex.noise2D(x * noiseScale, z * noiseScale) * 5);
            for (let y = 0; y <= height; y++) {
                createBlock(x, y, z, grassTexture);
            }
            if (Math.random() < 0.1) {
                createTree(x, height + 1, z);
            }
            if (height < 0) {
                fillWithWater(x, z); // Fill with water below a certain height
            }
        }
    }
}

// Function to handle chunk loading when player moves into a new chunk
function updateChunks() {
    const playerChunkX = Math.floor(camera.position.x / chunkSize);
    const playerChunkZ = Math.floor(camera.position.z / chunkSize);
    if (playerChunkX !== currentChunk.x || playerChunkZ !== currentChunk.z) {
        currentChunk.x = playerChunkX;
        currentChunk.z = playerChunkZ;
        generateChunk(playerChunkX, playerChunkZ);
        // Generate surrounding chunks
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                generateChunk(playerChunkX + dx, playerChunkZ + dz);
            }
        }
    }
}

// Function to break blocks under the crosshair
function breakBlockUnderCrosshair() {
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Cast a ray from the center of the screen
    raycaster.set(camera.position, direction);
    
    const intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length > 0) {
        const selectedBlock = intersects[0].object;

        // Apply crack texture on block before breaking it
        const crackMaterial = new THREE.MeshBasicMaterial({ map: blockBreakingCrackTexture });
        selectedBlock.material = crackMaterial;

        setTimeout(() => {
            scene.remove(selectedBlock); // Remove the block after showing cracks
        }, 200); // Delay to simulate block-breaking time
    }
}

// Lock the pointer
function lockPointer() {
    document.body.requestPointerLock();
}
document.body.addEventListener('click', lockPointer);

// Crosshair element
const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.width = '10px';
crosshair.style.height = '10px';
crosshair.style.backgroundColor = 'white';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.left = '50%';
crosshair.style.top = '50%';
crosshair.style.pointerEvents = 'none';
document.body.appendChild(crosshair);

// Player controls
const playerSpeed = 0.1;
let velocity = new THREE.Vector3(0, 0, 0);
let isJumping = false;
const keys = {};

// Keyboard events for movement
window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Mouse movement for looking around
let pitch = 0;
let yaw = 0;
const lookSensitivity = 0.1;
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
        yaw -= event.movementX * lookSensitivity;
        pitch -= event.movementY * lookSensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        camera.rotation.order = "YXZ";
        camera.rotation.set(pitch, yaw, 0);
    }
});

// Update player position and chunks
function updatePlayer() {
    velocity.set(0, 0, 0);

    if (keys['KeyW']) velocity.z = -playerSpeed;
    if (keys['KeyS']) velocity.z = playerSpeed;
    if (keys['KeyA']) velocity.x = -playerSpeed;
    if (keys['KeyD']) velocity.x = playerSpeed;

    if (keys['Space'] && !isJumping) {
        isJumping = true;
        velocity.y = 0.2;
    }

    if (camera.position.y > 1.5) {
        velocity.y -= 0.01; // Gravity
    } else {
        isJumping = false;
        camera.position.y = 1.5;
    }

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    camera.position.x += direction.x * -velocity.z;
    camera.position.z += direction.z * -velocity.z;
    camera.position.y += velocity.y;

    updateChunks(); // Load new chunks if necessary
}

// Handle breaking blocks
window.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
        breakBlockUnderCrosshair(); // Break block when clicking
    }
});

// Handle window resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer(); // Update player movement
    renderer.render(scene, camera);
}

// Start animation
animate();
