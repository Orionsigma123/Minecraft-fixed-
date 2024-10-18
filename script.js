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

// Constants for block size and chunk generation
const blockSize = 1;
const chunkSize = 16;
const renderDistance = 3; // Number of chunks to load around the player
const noiseScale = 0.1; // Scale of Perlin noise
const simplex = new SimplexNoise();

// Player position tracking
let currentChunk = { x: 0, z: 0 };
const loadedChunks = new Set();

// Function to create a block and add it to the scene
function createBlock(x, y, z, texture) {
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x * blockSize, y * blockSize, z * blockSize);
    scene.add(block);
    console.log(`Block created at (${x}, ${y}, ${z})`);
    return block;
}

// Function to generate terrain and water
function generateChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    if (loadedChunks.has(chunkKey)) return; // Skip if chunk already loaded
    loadedChunks.add(chunkKey);

    for (let x = chunkX * chunkSize; x < (chunkX + 1) * chunkSize; x++) {
        for (let z = chunkZ * chunkSize; z < (chunkZ + 1) * chunkSize; z++) {
            const noiseValue = simplex.noise2D(x * noiseScale, z * noiseScale);
            const height = Math.floor(noiseValue * 5);

            // Generate terrain blocks (grass)
            for (let y = 0; y <= height; y++) {
                createBlock(x, y, z, grassTexture);
            }

            // Add water where the noise is low
            if (noiseValue < -0.2) {
                for (let y = height; y < 0; y++) {
                    createBlock(x, y, z, waterTexture);
                }
            }

            // Randomly place trees
            if (Math.random() < 0.1 && height > 0) {
                createTree(x, height + 1, z);
            }
        }
    }
    console.log(`Chunk generated: (${chunkX}, ${chunkZ})`);
}

// Function to create a tree (basic square blocks for trunk and leaves)
function createTree(x, y, z) {
    // Trunk
    for (let i = 0; i < 3; i++) {
        createBlock(x, y + i, z, treeTexture);
    }

    // Leaves (square-shaped)
    for (let i = -1; i <= 1; i++) {
        for (let j = 3; j <= 4; j++) {
            for (let k = -1; k <= 1; k++) {
                createBlock(x + i, y + j, z + k, grassTexture);
            }
        }
    }
}

// Lock the pointer to the center of the screen
function lockPointer() {
    document.body.requestPointerLock();
}
document.body.addEventListener('click', lockPointer);

// Crosshair element for visual indication
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

// Player movement and control setup
const playerSpeed = 0.1;
let velocity = new THREE.Vector3(0, 0, 0);
let isJumping = false;
const keys = {};

// Keyboard input events
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

// Function to update player position and load chunks dynamically
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

    updateChunks();
}

// Function to load new chunks as the player moves
function updateChunks() {
    const playerChunkX = Math.floor(camera.position.x / chunkSize);
    const playerChunkZ = Math.floor(camera.position.z / chunkSize);
    if (playerChunkX !== currentChunk.x || playerChunkZ !== currentChunk.z) {
        currentChunk.x = playerChunkX;
        currentChunk.z = playerChunkZ;

        for (let dx = -renderDistance; dx <= renderDistance; dx++) {
            for (let dz = -renderDistance; dz <= renderDistance; dz++) {
                generateChunk(playerChunkX + dx, playerChunkZ + dz);
            }
        }
    }
}

// Handle window resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Initial camera position (start above ground to see blocks)
camera.position.set(0, 10, 0);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    renderer.render(scene, camera);
}

// Start animation loop
animate();
