
// ================= app.js 內容 =================
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
class SincerityApp {
    constructor() {
        this.state = 'loading';
        this.chargeStartTime = 0;
        this.jiaoObjects = [];
        this.isPressed = false;
        this.settleTimer = null;
        this.hasPlayedIntro = false;
        this.init().then(() => {
            this.idleStartTime = Date.now();
            this.state = 'idle';
            this.animate();
        });
    }
    async init() {
        await RAPIER.init();
        this.world = new RAPIER.World({ x: 0.0, y: -30.0, z: 0.0 });
        this.initThree();
        this.initPhysicsGround();
        this.initUI();
        this.initAudio();
        this.createBoundaries();
        this.createJiaoPair();
    }
    initThree() {
        const container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xEBE1CD);
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 30, 15);
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    initPhysicsGround() {
        let groundDesc = RAPIER.RigidBodyDesc.fixed();
        this.groundBody = this.world.createRigidBody(groundDesc);
        let groundColliderDesc = RAPIER.ColliderDesc.cuboid(25.0, 0.1, 25.0)
            .setTranslation(0, -0.1, 0)
            .setRestitution(0.5)
            .setFriction(0.5);
        this.world.createCollider(groundColliderDesc, this.groundBody);
    }
    initUI() {
        const canvas = this.renderer.domElement;
        const onPointerDown = () => {
            if (!this.hasPlayedIntro) return;
            if (this.state === 'idle' || this.state === 'settling') {
                this.isPressed = true;
                this.chargeStartTime = Date.now();
                this.state = 'charging';
                document.getElementById('instruction-text').textContent = '誠心祈求中...';
                this.jiaoObjects.forEach(obj => obj.charging = true);
            }
        };
        const onPointerUp = () => {
            if (this.state === 'charging') {
                this.isPressed = false;
                this.throwJiao();
            }
        };
        canvas.addEventListener('mousedown', onPointerDown);
        canvas.addEventListener('mouseup', onPointerUp);
        canvas.addEventListener('touchstart', onPointerDown);
        canvas.addEventListener('touchend', onPointerUp);
        document.getElementById('result-overlay').addEventListener('click', () => {
            this.hideResult();
            this.resetJiao();
        });
    }
    initAudio() {
        this.audioContext = null;
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
    }
    playImpactSound(velocity) {
        if (!this.audioContext) return;
        const ctx = this.audioContext;
        const now = ctx.currentTime;
        // volume 上限提高，基礎音量提升
        const volume = Math.min(Math.max((velocity - 0.5) * 0.25, 0.1), 1);
        if (volume <= 0) return;
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.05));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150 + Math.random() * 100;
        filter.Q.value = 2;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.2);
    }
    createJiaoMesh() {
        const geometry = new THREE.SphereGeometry(1, 48, 48);
        const posAttr = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        const colors = [];
        for (let i = 0; i < posAttr.count; i++) {
            vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            vertex.x *= 2.0;
            vertex.z *= 0.8;
            const bendFactor = 0.3;
            vertex.y += (vertex.x * vertex.x) * bendFactor;
            if (vertex.z < -0.05) vertex.z = -0.05;
            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
            if (vertex.z > 0.1) {
                colors.push(0.75, 0.25, 0.20);
            } else {
                colors.push(0.88, 0.41, 0.34);
            }
        }
        geometry.computeVertexNormals();
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.MeshToonMaterial({
            vertexColors: true,
            gradientMap: this.createToonGradient(),
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }
    /**
     * 投擲邊界
     */
    createBoundaries() {
        // 設定「供桌」的範圍大小 (半徑)
        const range = 6;
        const wallHeight = 1000;
        const thickness = 1;

        // 定義四面牆的位置 (前後左右)
        // 這些牆只有物理碰撞體 (Collider)，沒有 Mesh，所以是「隱形」的
        const walls = [
            // 左牆
            { x: -range, z: 0, w: thickness, d: range * 2 },
            // 右牆
            { x: range, z: 0, w: thickness, d: range * 2 },
            // 上牆 (後方)
            { x: 0, z: -range, w: range * 2, d: thickness },
            // 下牆 (前方)
            { x: 0, z: range, w: range * 2, d: thickness }
        ];

        walls.forEach(config => {
            // 建立靜態剛體 (不會動的牆)
            let bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(config.x, wallHeight / 2, config.z);
            let body = this.world.createRigidBody(bodyDesc);

            // 建立碰撞體 (長方體)
            // 注意：Rapier 的參數是「半長/半寬/半高」
            let colliderDesc = RAPIER.ColliderDesc.cuboid(
                config.w / 2, 
                wallHeight / 2, 
                config.d / 2
            );
            
            // 設定物理材質 (摩擦力與彈力)
            // friction: 摩擦力 (0~1)，設大一點才不會滑太久
            // restitution: 彈力 (0~1)，設小一點避免撞牆彈飛
            colliderDesc.setFriction(0.5).setRestitution(0.2);
            
            this.world.createCollider(colliderDesc, body);
        });
        
        console.log("🧱 隱形圍牆已建立");
    }
    createJiaoBody(mesh, position, rotationEuler) {
        let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(0.2)
            .setAngularDamping(0.3)
            .setCanSleep(true);
        let rigidBody = this.world.createRigidBody(rigidBodyDesc);
        let q = new THREE.Quaternion().setFromEuler(rotationEuler);
        rigidBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        const restitution = 0.35;
        const friction = 0.5;
        let baseCollider = RAPIER.ColliderDesc.cuboid(1.6 / 2, 0.1 / 2, 0.4 / 2)
            .setTranslation(0, 0, 0)
            .setRestitution(restitution)
            .setFriction(friction)
            .setDensity(0.5);
        this.world.createCollider(baseCollider, rigidBody);
        let centerBall = RAPIER.ColliderDesc.ball(0.55)
            .setTranslation(0, 0, 0.2)
            .setRestitution(restitution)
            .setFriction(friction)
            .setDensity(0.5);
        this.world.createCollider(centerBall, rigidBody);
        let leftBall = RAPIER.ColliderDesc.ball(0.45)
            .setTranslation(-1.2, 0.4, 0.1)
            .setRestitution(restitution)
            .setFriction(friction)
            .setDensity(0.5);
        this.world.createCollider(leftBall, rigidBody);
        let rightBall = RAPIER.ColliderDesc.ball(0.45)
            .setTranslation(1.2, 0.4, 0.1)
            .setRestitution(restitution)
            .setFriction(friction)
            .setDensity(0.5);
        this.world.createCollider(rightBall, rigidBody);
        return rigidBody;
    }
    createToonGradient() {
        const colors = new Uint8Array(3);
        colors[0] = 0; colors[1] = 128; colors[2] = 255;
        const gradientMap = new THREE.DataTexture(colors, colors.length, 1, THREE.LuminanceFormat);
        gradientMap.minFilter = THREE.NearestFilter;
        gradientMap.magFilter = THREE.NearestFilter;
        gradientMap.needsUpdate = true;
        return gradientMap;
    }
    createJiaoPair() {
        this.jiaoObjects.forEach(obj => {
            this.scene.remove(obj.mesh);
            if (this.world) {
                this.world.removeRigidBody(obj.rigidBody);
            }
        });
        this.jiaoObjects = [];
        const positions = [
            new THREE.Vector3(1, 2, 0),
            new THREE.Vector3(1, 2, 0)
        ];
        positions.forEach((pos, index) => {
            const mesh = this.createJiaoMesh();
            let rotation;
            if (index === 0) {
                rotation = new THREE.Euler(-Math.PI / 2, 0, 0);
            } else {
                rotation = new THREE.Euler(Math.PI / 2, 0, 0);
            }
            const rigidBody = this.createJiaoBody(mesh, pos, rotation);
            this.scene.add(mesh);
            this.jiaoObjects.push({ mesh, rigidBody, charging: false });
        });
    }
    throwJiao() {
        this.state = 'throwing';
        document.getElementById('instruction-text').textContent = '';
        const chargeTime = Date.now() - this.chargeStartTime;
        const power = Math.min(chargeTime / 1000, 1.2);
        this.jiaoObjects.forEach((obj) => {
            const impulseBase = 25;
            const impulsePower = 20;
            const impulseY = impulseBase + power * impulsePower;
            const spread = 8;
            obj.rigidBody.applyImpulse({
                x: (Math.random() - 0.5) * spread,
                y: impulseY,
                z: (Math.random() - 0.5) * spread
            }, true);
            const torqueStrength = 2.0;
            obj.rigidBody.applyTorqueImpulse({
                x: (Math.random() - 0.5) * torqueStrength,
                y: (Math.random() - 0.5) * torqueStrength,
                z: (Math.random() - 0.5) * torqueStrength
            }, true);
            obj.charging = false;
        });
        setTimeout(() => { this.state = 'settling'; }, 1500);
    }
    checkSettled() {
        if (this.state !== 'settling') return;
        const velocityThreshold = 0.05;
        const angularThreshold = 0.1;
        const allSettled = this.jiaoObjects.every(obj => {
            const v = obj.rigidBody.linvel();
            const av = obj.rigidBody.angvel();
            const vLen = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            const avLen = Math.sqrt(av.x * av.x + av.y * av.y + av.z * av.z);
            return vLen < velocityThreshold && avLen < angularThreshold;
        });
        if (allSettled) {
            if (!this.settleTimer) this.settleTimer = Date.now();
            if (Date.now() - this.settleTimer > 400) {
                this.state = 'result';
                this.settleTimer = null;
                this.determineResult();
            }
        } else {
            this.settleTimer = null;
        }
    }
    determineResult() {
        const results = this.jiaoObjects.map(obj => {
            const q = obj.rigidBody.rotation();
            const threeQ = new THREE.Quaternion(q.x, q.y, q.z, q.w);
            const localZ = new THREE.Vector3(0, 0, 1);
            const worldZ = localZ.applyQuaternion(threeQ);
            const threshold = 0.5;
            if (worldZ.y > threshold) return 'yin';
            else if (worldZ.y < -threshold) return 'yang';
            else return 'li';
        });
        let title, description;
        if (results.includes('li')) {
            title = '立 筊'; description = '神跡顯現 · 所求之事非同小可';
        } else if ((results[0] === 'yang' && results[1] === 'yin') || (results[0] === 'yin' && results[1] === 'yang')) {
            title = '聖 筊'; description = '神明應允 · 心誠則靈';
        } else if (results[0] === 'yang' && results[1] === 'yang') {
            title = '笑 筊'; description = '神明微笑 · 語意不清或再試一次';
        } else {
            title = '陰 筊'; description = '時機未至 · 靜心等待';
        }
        this.showResult(title, description);
    }
    showResult(title, description) {
        document.getElementById('result-title').textContent = title;
        document.getElementById('result-description').textContent = description;
        const overlay = document.getElementById('result-overlay');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('show'), 50);
    }
    hideResult() {
        const overlay = document.getElementById('result-overlay');
        overlay.classList.remove('show');
        setTimeout(() => overlay.classList.add('hidden'), 500);
    }
    resetJiao() {
        this.state = 'idle';
        document.getElementById('instruction-text').textContent = '按住畫面 誠心祈求';
        this.createJiaoPair();
    }
    updatePhysics() {
        this.world.step();
        this.jiaoObjects.forEach(obj => {
            const v = obj.rigidBody.linvel();
            const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            if (obj.lastSpeed && (obj.lastSpeed - speed) > 2.0) {
                this.playImpactSound(obj.lastSpeed - speed);
            }
            obj.lastSpeed = speed;
        });
        this.jiaoObjects.forEach(obj => {
            const t = obj.rigidBody.translation();
            const r = obj.rigidBody.rotation();
            obj.mesh.position.set(t.x, t.y, t.z);
            obj.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        });
        this.checkSettled();
    }
    updateIdleAnimation() {
        if (this.state === 'idle') {
            const now = Date.now();
            const time = now * 0.001;
            if (!this.introStartTime) {
                this.introStartTime = now;
            }
            if (this.hasPlayedIntro === undefined) {
                this.hasPlayedIntro = false;
            }
            const delayTime = 2.0;
            const duration = 2.0;
            const startCamPos = new THREE.Vector3(0, 60, 20);
            const endCamPos = new THREE.Vector3(0, 20, 20);
            const elapsed = (now - this.introStartTime) / 1000;
            let progress = 0;
            if (this.hasPlayedIntro) {
                progress = 1;
                this.camera.position.copy(endCamPos);
            } else {
                if (elapsed < delayTime) {
                    progress = 0;
                    this.camera.position.copy(startCamPos);
                } else {
                    const actionTime = elapsed - delayTime;
                    progress = Math.min(actionTime / duration, 1);
                    progress = 1 - Math.pow(1 - progress, 3);
                    this.camera.position.lerpVectors(startCamPos, endCamPos, progress);
                    if (progress >= 0.999) {
                        this.hasPlayedIntro = true;
                        progress = 1;
                        document.getElementById('instruction-text').textContent = '按住畫面 誠心祈求';
                    }
                }
            }
            this.camera.lookAt(0, 0, 0);
            this.jiaoObjects.forEach((obj, index) => {
                const floatY = 0.5 + Math.sin(time + index) * 0.05;
                const floatX = -2 + index * 4;
                obj.rigidBody.setTranslation({ x: floatX, y: floatY, z: 0 }, true);
                obj.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                obj.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
                const q = new THREE.Quaternion();
                if (index === 0) {
                    const currentZ = 0 + (-Math.PI / 2 - 0) * progress;
                    q.setFromEuler(new THREE.Euler(
                        -Math.PI / 2 + Math.sin(time) * 0.05,
                        0,
                        currentZ
                    ));
                } else {
                    const startX = Math.PI / 2;
                    const endX = -Math.PI / 2;
                    const currentX = startX + (endX - startX) * progress;
                    const currentZ = 0 + (Math.PI / 2 - 0) * progress;
                    q.setFromEuler(new THREE.Euler(
                        currentX + Math.cos(time) * 0.05,
                        0,
                        currentZ
                    ));
                }
                obj.rigidBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
            });
        }
    }
    updateChargingAnimation() {
        if (this.state === 'charging') {
            const time = Date.now() * 0.02;
            this.jiaoObjects.forEach((obj, index) => {
                if (obj.charging) {
                    const trembleX = Math.sin(time * 20 + index) * 0.03;
                    const trembleY = Math.cos(time * 25 + index) * 0.03;
                    const currentPos = obj.rigidBody.translation();
                    obj.rigidBody.setTranslation({
                        x: currentPos.x + trembleX,
                        y: currentPos.y + trembleY,
                        z: currentPos.z
                    }, true);
                }
            });
        }
    }
    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.state !== 'loading') {
            this.updateIdleAnimation();
            this.updateChargingAnimation();
            this.updatePhysics();
        }
        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('resize', () => {
    // 更新相機
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    if (this.hasPlayedIntro) {
        const targetPos = this.getResponsiveCameraPos(false);
        this.camera.position.copy(targetPos);
        this.camera.lookAt(0, 0, 0);
    }
});

window.app = new SincerityApp();