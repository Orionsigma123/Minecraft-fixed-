// Setup basic scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true }); // Enable alpha for transparency
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set the background color of the scene
renderer.setClearColor(0x87CEEB, 1); // Sky blue color

// Textures
const grassTexture = new THREE.TextureLoader().load('textures/grass.png'); // Replace with your grass texture path 

// Inventory
const inventory = [];

// Generate a simple block world using Perlin noise
let blockSize = 1;
let renderDistance = 16; // Initial render distance
const worldWidth = 200; // Increased world size
const worldHeight = 204; // Increased world size
const noiseScale = 0.1; // Adjust for terrain smoothness
const simplex = new SimplexNoise();

// Function to create a block
function createBlock(x, y, z, texture) {
    const geometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
    const material = new THREE.MeshBasicMaterial({ map: texture }); // Use the specified texture
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x * blockSize, y * blockSize, z * blockSize);
    block.userData = { x, y, z }; // Store position for easy access later
    scene.add(block);
}

// Function to generate the world
function generateWorld() {
    for (let x = -renderDistance; x <= renderDistance; x++) {
        for (let z = -renderDistance; z <= renderDistance; z++) {
            const height = Math.floor(simplex.noise2D(x * noiseScale, z * noiseScale) * 5);
            for (let y = 0; y <= height; y++) {
                createBlock(x, y, z, grassTexture); // Use grass texture for blocks
            }
        }
    }
}

// Initial call to generate the world
generateWorld();

// Position the camera to be just above the ground
camera.position.set(25, 0.4, 25); // Adjust height to be 2 blocks tall

// Player controls
const playerSpeed = 0.1;
const jumpForce = 0.3; // Jumping force increased
let velocity = new THREE.Vector3(0, 0, 0);
let isJumping = false;
const keys = {};
let mousePressed = false;
let selectedBlock = null;

// Inventory management functions
function addToInventory(block) {
    const emptySlot = inventory.findIndex(item => item === undefined); // Find first empty slot
    if (emptySlot !== -1) {
        inventory[emptySlot] = block; // Add block to inventory
        renderInventory(); // Update the inventory UI
    }
}

window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Function to simulate block breaking and add to inventory
function breakBlock(block) {
    const blockPosition = block.userData; // Get block position
    addToInventory({ name: 'Grass Block', texture: grassTexture }); // Add block to inventory
    scene.remove(block); // Remove block from scene
}

// Function to get the block under the crosshair (not mouse pointer)
function getBlockUnderCrosshair() {
    const raycaster = new THREE.Raycaster();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    raycaster.set(camera.position, cameraDirection); // Cast ray from camera in its direction
    const intersects = raycaster.intersectObjects(scene.children);

    return intersects.length > 0 ? intersects[0].object : null; // Return the block if intersected
}

// Handle left mouse button down event (to break a block)
window.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        const block = getBlockUnderCrosshair(); // Get the block under the crosshair
        if (block) {
            breakBlock(block); // Break the block
        }
    }
});

// Function to lock the mouse pointer
function lockPointer() {
    document.body.requestPointerLock();
}

// Lock the pointer on mouse click
document.body.addEventListener('click', lockPointer);

// Mouse movement for looking around
let pitch = 0; // Up and down rotation (X-axis)
let yaw = 0; // Left and right rotation (Y-axis)
const lookSensitivity = 0.1; // Sensitivity for vertical look

// Adjust the camera rotation logic to lock the Z-axis (roll)
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
        yaw -= event.movementX * lookSensitivity; // Left/right
        pitch -= event.movementY * lookSensitivity; // Up/down

        // Clamp pitch to prevent flipping (X-axis rotation between -90° and 90°)
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

        // Apply camera rotation using Euler angles (yaw for left/right, pitch for up/down)
        camera.rotation.order = "YXZ"; // Yaw (Y) first, then pitch (X)
        camera.rotation.set(pitch, yaw, 0); // Keep Z-axis (roll) locked at 0
    }
});

// Handle movement
function updatePlayer() {
    velocity.set(0, 0, 0); // Reset velocity

    if (keys['KeyS']) { // Move backward (S)
        velocity.z = playerSpeed; // Move forward
    } else if (keys['KeyW']) { // Move forward (W)
        velocity.z = -playerSpeed; // Move backward
    }

    if (keys['KeyA']) { // Move left
        velocity.x = -playerSpeed;
    } else if (keys['KeyD']) { // Move right
        velocity.x = playerSpeed;
    }

    // Jumping logic
    if (keys['Space'] && !isJumping) {
        isJumping = true;
        velocity.y = jumpForce; // Initial jump velocity
    }

    // Apply gravity
    if (camera.position.y > 2) { // Player height is 2 blocks
        velocity.y -= 0.1; // Gravity effect
    } else {
        isJumping = false; // Reset jumping when hitting the ground
        camera.position.y = 2; // Ensure the camera stays at 2 blocks height
        velocity.y = 0; // Reset vertical velocity when on the ground
    }

    // Move the camera based on the direction it's facing
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Get the direction the camera is facing
    direction.y = 0; // Ignore vertical direction for horizontal movement
    direction.normalize(); // Normalize direction to ensure consistent speed

    // Update camera position based on direction
    camera.position.x += direction.x * -velocity.z; // Reverse movement for forward
    camera.position.z += direction.z * -velocity.z; // Reverse movement for forward
    camera.position.y += velocity.y; // Update vertical position

    // Collision detection to prevent phasing through blocks
    camera.position.x = Math.max(0, Math.min(camera.position.x, worldWidth - 1)); // Constrain camera within bounds
    camera.position.z = Math.max(0, Math.min(camera.position.z, worldHeight - 1));

    // Check collision with ground (simple method)
    const groundHeight = Math.floor(simplex.noise2D(camera.position.x * noiseScale, camera.position.z * noiseScale) * 5); // Check height at camera position
    if (camera.position.y < groundHeight + 2) { // Ensure player can only jump one block height
        camera.position.y = groundHeight + 2; // Place the camera on top of the ground (2 blocks tall)
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
});

// Render distance slider event
const renderDistanceInput = document.getElementById('renderDistance');
const renderDistanceValue = document.getElementById('renderDistanceValue');

renderDistanceInput.addEventListener('input', (event) => {
    renderDistance = parseInt(event.target.value);
    renderDistanceValue.textContent = renderDistance; // Update the displayed value
    regenerateWorld(); // Regenerate the world based on new render distance
});

// Function to regenerate the world based on the render distance
function regenerateWorld() {
    // Clear existing blocks
    while (scene.children.length) {
        scene.remove(scene.children[0]); // Clear all objects in the scene
    }
    generateWorld(); // Regenerate the world with the updated render distance
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updatePlayer(); // Update player movement
    renderer.render(scene, camera);
}

// Start animation
animate();
