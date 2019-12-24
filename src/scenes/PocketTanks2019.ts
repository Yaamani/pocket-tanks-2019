import { Scene } from '../common/game';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils'
import ShaderProgram from '../common/shader-program';
import Camera from '../common/camera';
import { vec3, mat4 } from 'gl-matrix';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import Input from '../common/input';
import { Vec3 } from 'webgl-obj-loader';
import { Key } from 'ts-key-enum';


export default class PocketTanks2019 extends Scene {

    program: ShaderProgram;
    camera: Camera;
    camera2: Camera;
    controller: FlyCameraController;
    input: Input;

    tankPos: vec3;
    tankRotY: number;
    
    tankPos2: vec3;
    tankRotY2: number;
    
    tankMesh: Mesh;
    tankTexture: WebGLTexture;
    tankSampler: WebGLSampler;
    
    groundMesh: Mesh;
    groundTexture: WebGLTexture;
    groundSampler: WebGLSampler;

    cube: Mesh;

    VAO: WebGLVertexArrayObject; // Vertex Array Object: This will store how the GPU will read our buffer to draw the triangle 
    VBO: WebGLBuffer; // Vertex Buffer Object: This will store the vertex data of our triangle

    public load(): void {
        //throw new Error("Method not implemented.");

        this.game.loader.load(
            {
                ["color.vert"]:{url:'assets/shaders/color.vert', type:'text'}, 
                ["color.frag"]:{url:'assets/shaders/color.frag', type:'text'},

                ["texture.vert"]:{url:'assets/shaders/texture.vert', type:'text'}, 
                ["texture.frag"]:{url:'assets/shaders/texture.frag', type:'text'},


                ["tank-model"]:{url:'assets/art/Tank/mother-3-pork-tank/source/tank-mother-pork.obj', type:'text'}, 
                ["tank-texture"]:{url:'assets/art/Tank/mother-3-pork-tank/textures/Material-_3_Base_Color.jpeg', type:'image'}, 

                ["ground-texture"]:{url:'assets/ground/TexturesCom_Gravel0070_1_seamless_S.jpg' ,type:'image'}

            }
        );
    }    
    
    public start(): void {
        console.log("Hello PocketTanks2019");

        this.input = new Input(this.game.canvas);

        this.program = new ShaderProgram(this.gl);
        this.initializeShader(this.program, 'texture');

        this.tankPos = vec3.fromValues(0, 0, -10);
        this.tankRotY = 0;

        this.tankPos2 = vec3.fromValues(0, 0, -10);
        this.tankRotY2 = 0;

        
        this.tankMesh = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["tank-model"]);

        this.tankTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tankTexture);
        this.initializeTexture("tank-texture");
        this.tankSampler = this.gl.createSampler();
        this.initializeSampler(this.tankSampler);
        

        this.groundMesh = MeshUtils.Plane(this.gl, {min:[0,0], max:[100,100]});

        this.groundTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.groundTexture);
        this.initializeTexture("ground-texture");
        this.groundSampler = this.gl.createSampler();
        this.initializeSampler(this.groundSampler);
        

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;

        this.camera2 = new Camera();
        this.camera2.type = 'perspective';
        this.camera2.aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;

        this.initializeCameraFlyController();

        this.glFinalization();

        this.gl.clearColor(0, 0, 0, 1);
    }

    
    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        
        // this.idris += 0.05;

        // this.camera.position = vec3.fromValues(this.idris, this.idris, -5);
        // this.camera.direction = vec3.fromValues(this.idris, this.idris, 0);

        //throw new Error("Method not implemented.");
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.program.use();

        this.listenForPlayer1Input();
        this.listenForPlayer2Input();

        

        let VP1 = this.camera.ViewProjectionMatrix;
        let VP2 = this.camera2.ViewProjectionMatrix;

        let defaultVP = VP1; 

        if (this.input.isKeyDown('1')) {
            defaultVP = VP1;
        }
        if (this.input.isKeyDown('2')) {
            defaultVP = VP2;
        }
        
        let groundMat = mat4.clone(defaultVP);
        mat4.scale(groundMat, groundMat, [100, 1, 100]);





        let tankMat = mat4.clone(defaultVP);
        mat4.translate(tankMat, tankMat, this.tankPos);
        mat4.rotateY(tankMat, tankMat, this.tankRotY);
 
        this.camera.position = vec3.fromValues(this.tankPos[0]-Math.sin(this.tankRotY)*5, this.tankPos[1] + 5, this.tankPos[2]-Math.cos(this.tankRotY)*5);
        this.camera.direction = vec3.fromValues(Math.sin(this.tankRotY), this.tankPos[1], Math.cos(this.tankRotY));




        let tankMat2 = mat4.clone(defaultVP);
        mat4.translate(tankMat2, tankMat2, this.tankPos2);
        mat4.rotateY(tankMat2, tankMat2, this.tankRotY2);

        this.camera2.position = vec3.fromValues(this.tankPos2[0]-Math.sin(this.tankRotY2)*5, this.tankPos2[1] + 5, this.tankPos2[2]-Math.cos(this.tankRotY2)*5);
        this.camera2.direction = vec3.fromValues(Math.sin(this.tankRotY2), this.tankPos2[1], Math.cos(this.tankRotY2));

        // let M = mat4.identity(mat4.create()); // Since we won't move the rectangle, M is an identity matrix
        // // The view matrix can be created using the function LookAt which takes the camera position, its target and its up direction
        // let V = mat4.lookAt(mat4.create(), this.camera.position, this.camera.direction, this.camera.up);
        // // The projection can be done "perspective" for perspective vertices and "ortho" for orthographic matrices
        // // For the perspective matrix, we supply the Field of View angle of the Y axis, the aspect ratio, and the near and far planes
        // // For the orthographic matrix, we supply our view box (left, right, bottom, top, near, far)
        // let P = mat4.perspective(mat4.create(), this.camera.perspectiveFoVy, this.camera.aspectRatio, this.camera.near, this.camera.far);
        
        // // Now we multiply our matrices in order P*V*M
        // let MVP = mat4.create();
        // mat4.mul(MVP, MVP, P);
        // mat4.mul(MVP, MVP, V);
        // mat4.mul(MVP, MVP, M);

        this.program.setUniform2f("tiling_factor", [1, 1]);
        this.program.setUniformMatrix4fv("MVP", false, tankMat);
        this.program.setUniform4f("tint", [1, 1, 1, 1]);
        
        this.drawTexture(this.tankTexture, this.tankSampler);
        this.tankMesh.draw(this.gl.TRIANGLES);

        this.program.setUniform2f("tiling_factor", [1, 1]);
        this.program.setUniformMatrix4fv("MVP", false, tankMat2);
        this.program.setUniform4f("tint", [1, 1, 1, 1]);
        
        this.drawTexture(this.tankTexture, this.tankSampler);
        this.tankMesh.draw(this.gl.TRIANGLES);
        
        this.program.setUniform2f("tiling_factor", [.35, .35]);
        this.program.setUniformMatrix4fv("MVP", false, groundMat);
        this.program.setUniform4f("tint", [1, 1, 1, 1]);

        this.drawTexture(this.groundTexture, this.groundSampler);
        this.groundMesh.draw(this.gl.TRIANGLES);
    }
    
    public end(): void {
        //throw new Error("Method not implemented.");
        this.program.dispose();
        this.program = null;
        this.cube.dispose();
        this.cube = null;
    }

    
    ////////////////////////////////////////////////////////

    private initializeShader(program: ShaderProgram , name: string) {
        program.attach(this.game.loader.resources[name+'.vert'], this.gl.VERTEX_SHADER);
        program.attach(this.game.loader.resources[name+'.frag'], this.gl.FRAGMENT_SHADER);
        program.link();
    }

    private initializeTexture(name: string) {
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.game.loader.resources[name]);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);        
    }

    private initializeSampler(sampler: WebGLSampler) {
        this.gl.samplerParameteri(sampler, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.samplerParameteri(sampler, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.samplerParameteri(sampler, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(sampler, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
    }

    private drawTexture(texture: WebGLTexture, sampler: WebGLSampler) {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.program.setUniform1i('texture_sampler', 0);
        this.gl.bindSampler(0, sampler);
    }

    private glFinalization() {
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
    }

    ////////////////////////////////////////////////////////

    private initializeCameraFlyController() {
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.005;
    }

    private listenForPlayer1Input() {
        if (this.input.isKeyDown('w')) {
            this.tankPos[2] += Math.cos(this.tankRotY) * 0.135;
            this.tankPos[0] += Math.sin(this.tankRotY) * 0.135;
        }

        if (this.input.isKeyDown('s')) {
            this.tankPos[2] -= Math.cos(this.tankRotY) * 0.135;
            this.tankPos[0] -= Math.sin(this.tankRotY) * 0.135;
        }

        if (this.input.isKeyDown('a')) {
            this.tankRotY+= 0.035;
        }

        if (this.input.isKeyDown('d')) {
            this.tankRotY-= 0.035;
        }
    }

    private listenForPlayer2Input() {
        if (this.input.isKeyDown(Key.ArrowUp)) {
            this.tankPos2[2] += Math.cos(this.tankRotY2) * 0.135;
            this.tankPos2[0] += Math.sin(this.tankRotY2) * 0.135;
        }

        if (this.input.isKeyDown(Key.ArrowDown)) {
            this.tankPos2[2] -= Math.cos(this.tankRotY2) * 0.135;
            this.tankPos2[0] -= Math.sin(this.tankRotY2) * 0.135;
        }

        if (this.input.isKeyDown(Key.ArrowLeft)) {
            this.tankRotY2+= 0.035;
        }

        if (this.input.isKeyDown(Key.ArrowRight)) {
            this.tankRotY2-= 0.035;
        }
    }
}
