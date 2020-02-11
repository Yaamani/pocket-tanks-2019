import { Scene } from '../common/game';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils'
import ShaderProgram from '../common/shader-program';
import Camera from '../common/camera';
import { vec3, mat4, quat } from 'gl-matrix';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import Input from '../common/input';
import { Vec3 } from 'webgl-obj-loader';
import { Key } from 'ts-key-enum';
import * as TextureUtils from '../common/texture-utils';


interface AmbientLight {
    type: 'ambient',
    enabled: boolean,
    skyColor: vec3,
    groundColor: vec3,
    skyDirection: vec3
};

interface DirectionalLight {
    type: 'directional',
    enabled: boolean,
    color: vec3,
    direction: vec3
};

interface PointLight {
    type: 'point',
    enabled: boolean,
    color: vec3,
    position: vec3,
    attenuation_quadratic: number,
    attenuation_linear: number,
    attenuation_constant: number
};

interface SpotLight {
    type: 'spot',
    enabled: boolean,
    color: vec3,
    position: vec3,
    direction: vec3,
    attenuation_quadratic: number,
    attenuation_linear: number,
    attenuation_constant: number,
    inner_cone: number,
    outer_cone: number
};

// This union type: it can be any of the specified types
type Light = AmbientLight | DirectionalLight | PointLight | SpotLight;

// This will store the material properties
// To be more consistent with modern workflows, we use what is called albedo to define the diffuse and ambient
// And since specular power (shininess) is in the range 0 to infinity and the more popular roughness paramater is in the range 0 to 1, we read the roughness from the image and convert it to shininess (specular power)
// We also add an emissive properties in case the object itself emits light
// Finally, while the ambient is naturally the same a the diffuse, some areas recieve less ambient than other (e.g. folds), so we use the ambient occlusion texture to darken the ambient in these areas
// We also add tints and scales to control the properties without using multiple textures
interface Material {
    albedo: WebGLTexture,
    albedo_tint: vec3,
    specular: WebGLTexture,
    specular_tint: vec3
    roughness: WebGLTexture,
    roughness_scale: number,
    ambient_occlusion: WebGLTexture,
    emissive: WebGLTexture,
    emissive_tint: vec3
};

// This will represent an object in 3D space
interface Object3D {
    mesh: Mesh,
    texture: WebGLTexture,
    material: Material,
    modelMatrix: mat4
};


interface Bullet {
    modelMat: mat4,
    orientationY: number, 
    owner: "leftPlayer"|"rightPlayer"
}

export default class PocketTanks2019 extends Scene {

    program: ShaderProgram;
    camera: Camera;
    camera2: Camera;
    controller: FlyCameraController;
    input: Input;

    tankPosLeft: vec3;
    tankRotYLeft: number;
    
    tankPosRight: vec3;
    tankRotYRight: number;
    
    tankMesh: Mesh;
    tankTexture: WebGLTexture;
    tankNormal: WebGLTexture;
    tankAmbientOcclusion: WebGLTexture;
    tankRoughness: WebGLTexture;
    
    groundMesh: Mesh;
    groundTexture: WebGLTexture;
    groundAlbedo: WebGLTexture;
    groundNormal: WebGLTexture;
    groundRoughness: WebGLTexture;

    bulletMesh: Mesh;
    bulletAlbedo: WebGLTexture;
    bulletNormal: WebGLTexture;
    bulletRoughness: WebGLTexture;
    bulletEmissive: WebGLTexture;
    bulletAmbientOcclusion: WebGLTexture;

    bullets: Bullet[] = [];

    whiteTexture: WebGLTexture;
    blackTexture: WebGLTexture;

    universalSampler: WebGLSampler;

    objects: {[name: string]: Object3D} = {};

    VAO: WebGLVertexArrayObject; // Vertex Array Object: This will store how the GPU will read our buffer to draw the triangle 
    VBO: WebGLBuffer; // Vertex Buffer Object: This will store the vertex data of our triangle

    tank_collision_threshold: number = 5;


    lights: Light[] = [
        { type: "ambient", enabled: true, skyColor: vec3.fromValues(1, 1, 1), groundColor: vec3.fromValues(0.5, 0.5, 0.5), skyDirection: vec3.fromValues(0,1,0)},
        { type: 'directional', enabled: true, color: vec3.fromValues(0.5,0.5,0.5), direction:vec3.fromValues(0,-1,0) },
        { type: 'point', enabled: true, color: vec3.fromValues(1,0,0), position:vec3.fromValues(22,+13,+0), attenuation_quadratic:0.5, attenuation_linear:0, attenuation_constant:0 },
        { type: 'point', enabled: true, color: vec3.fromValues(0,1,0), position:vec3.fromValues(-6,+1,+0), attenuation_quadratic:1, attenuation_linear:0, attenuation_constant:0 },
        { type: 'point', enabled: true, color: vec3.fromValues(0,0,1), position:vec3.fromValues(+0,+1,+6), attenuation_quadratic:1, attenuation_linear:0, attenuation_constant:0 },
        { type: 'point', enabled: true, color: vec3.fromValues(1,1,0), position:vec3.fromValues(+0,+1,-6), attenuation_quadratic:1, attenuation_linear:0, attenuation_constant:0 },
        { type: 'spot', enabled: true, color: vec3.fromValues(1,1,1), position:vec3.fromValues(+32,+1,+3), direction:vec3.fromValues(-1,0,-1), attenuation_quadratic:1, attenuation_linear:0, attenuation_constant:0, inner_cone: 0.25*Math.PI, outer_cone: 0.3*Math.PI },
        { type: 'spot', enabled: true, color: vec3.fromValues(0,5,0), position:vec3.fromValues(-3,+1,+32), direction:vec3.fromValues(+1,0,-1), attenuation_quadratic:1, attenuation_linear:0, attenuation_constant:0, inner_cone: 0.25*Math.PI, outer_cone: 0.3*Math.PI  },
        { type: 'spot', enabled: true, color: vec3.fromValues(5,5,5), position:vec3.fromValues(32,+1,-32), direction:vec3.fromValues(-1,0,+1), attenuation_quadratic:1, attenuation_linear:0, attenuation_constant:0, inner_cone: 0.25*Math.PI, outer_cone: 0.3*Math.PI  },
        { type: 'spot', enabled: true, color: vec3.fromValues(5,5,0), position:vec3.fromValues(-32,+1,-32), direction:vec3.fromValues(+1,0,+1), attenuation_quadratic:1, attenuation_linear:0, attenuation_constant:0, inner_cone: 0.25*Math.PI, outer_cone: 0.3*Math.PI  },
    ];

    lightPrograms: {[name: string]: ShaderProgram} = {};

    public load(): void {
        //throw new Error("Method not implemented.");

        this.game.loader.load(
            {
                ["color.vert"]:{url:'assets/shaders/color.vert', type:'text'}, 
                ["color.frag"]:{url:'assets/shaders/color.frag', type:'text'},

                ["texture.vert"]:{url:'assets/shaders/texture.vert', type:'text'}, 
                ["texture.frag"]:{url:'assets/shaders/texture.frag', type:'text'},

                ["light.vert"]:{url:'assets/shaders/light.vert', type:'text'}, 
                ["ambient.frag"]:{url:'assets/shaders/ambient.frag', type:'text'}, 
                ["point.frag"]:{url:'assets/shaders/point.frag', type:'text'}, 
                ["directional.frag"]:{url:'assets/shaders/directional.frag', type:'text'}, 
                ["spot.frag"]:{url:'assets/shaders/spot.frag', type:'text'}, 


                ["tank-model"]:{url:'assets/art/Tank/mother-3-pork-tank/source/tank-mother-pork.obj', type:'text'}, 
                ["tank-texture"]:{url:'assets/art/Tank/mother-3-pork-tank/textures/Material-_3_Base_Color.jpeg', type:'image'}, 
                ["tank-texture-normal"]:{url:'assets/art/Tank/mother-3-pork-tank/textures/Material-_3_Normal_DirectX.jpg', type:'image'}, 
                ["tank-texture-roughness"]:{url:'assets/art/Tank/mother-3-pork-tank/textures/Material-_3_Roughness.jpg', type:'image'}, 
                ["tank-texture-ambient-occlusion"]:{url:'assets/art/Tank/mother-3-pork-tank/textures/Material _3_Mixed_AO.jpg', type:'image'}, 

                ["ground-texture"]:{url:'assets/ground/TexturesCom_MuddySand2_2x2_2K_height.jpg' ,type:'image'},
                ["ground-texture-albedo"]:{url:'assets/ground/TexturesCom_MuddySand2_2x2_2K_albedo.jpg' ,type:'image'}, 
                ["ground-texture-normal"]:{url:'assets/ground/TexturesCom_MuddySand2_2x2_2K_normal.jpg' ,type:'image'}, 
                ["ground-texture-roughness"]:{url:'assets/ground/TexturesCom_MuddySand2_2x2_2K_roughness.jpg' ,type:'image'}, 

                ["bullet-model"]:{url:'assets/art/Bullet/9x19-lead-bullet/lead-bullet.obj', type: 'text'},
                ["bullet-texture-albedo"] :{url:'assets/art/Bullet/9x19-lead-bullet/textures/pula_albedo.jpeg', type: 'image'}, 
                ["bullet-texture-ambient-occlusion"] :{url:'assets/art/Bullet/9x19-lead-bullet/textures/pula_AO.jpeg', type: 'image'}, 
                ["bullet-texture-emissive"] :{url:'assets/art/Bullet/9x19-lead-bullet/textures/pula_metallic.jpeg', type: 'image'}, 
                ["bullet-texture-roughness"] :{url:'assets/art/Bullet/9x19-lead-bullet/textures/pula_roughness.jpeg', type: 'image'}, 
                ["bullet-texture-normal"] :{url:'assets/art/Bullet/9x19-lead-bullet/textures/pula_normal.jpeg', type: 'image'}

            }
        );
    }    
    
    public start(): void {
        console.log("Hello PocketTanks2019");

        this.input = new Input(this.game.canvas);

        this.whiteTexture = TextureUtils.SingleColor(this.gl, [255, 255, 255, 255]);
        this.blackTexture = TextureUtils.SingleColor(this.gl, [0, 0, 0, 255]);

        for(let type of ['ambient', 'directional', 'point', 'spot']){
            this.lightPrograms[type] = new ShaderProgram(this.gl);
            this.lightPrograms[type].attach(this.game.loader.resources['light.vert'], this.gl.VERTEX_SHADER);
            this.lightPrograms[type].attach(this.game.loader.resources[`${type}.frag`], this.gl.FRAGMENT_SHADER);
            this.lightPrograms[type].link();
        }

        this.program = new ShaderProgram(this.gl);
        this.initializeShader(this.program, 'texture');

        this.tankPosLeft = vec3.fromValues(0, 0, -10);
        this.tankRotYLeft = 0;

        this.tankPosRight = vec3.fromValues(0, 0, 10);
        this.tankRotYRight = Math.PI;

        
        this.tankMesh = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["tank-model"]);
        this.groundMesh = MeshUtils.Plane(this.gl, {min:[0,0], max:[100,100]});
        this.bulletMesh = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["bullet-model"]);

        this.initializeTankTexture();
        this.initializeTankNormal();
        this.initializeTankRoughness();
        this.initializeTankAmbientOcclusion();

        this.initializeGroundTexture();
        this.initializeGroundAlbedo();
        this.initializeGroundNormal();
        this.initializeGroundRoughness();

        this.initializeBulletAlbedo();
        this.initializeBulletNormal();
        this.initializeBulletRoughness();
        this.initializeBulletEmissive();
        this.initializeBulletAmbientOcclusion();


        this.initializeUniversalSampler();


        this.objects['ground'] = {
            mesh: this.groundMesh,
            material: {
                albedo: this.groundAlbedo,
                albedo_tint: vec3.fromValues(1, 1, 1),
                specular: this.blackTexture,
                specular_tint: vec3.fromValues(1, 1, 1),
                roughness: this.groundRoughness,
                roughness_scale: 1,
                emissive: this.blackTexture,
                emissive_tint: vec3.fromValues(1, 1, 1),
                ambient_occlusion: this.whiteTexture
            },
            texture: this.groundTexture,
            modelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 0, 0), vec3.fromValues(100, 1, 100))
        };

        this.objects['tank'] = {
            mesh: this.tankMesh,
            material: {
                albedo: this.tankTexture,
                albedo_tint: vec3.fromValues(1, 1, 1),
                specular: this.blackTexture,
                specular_tint: vec3.fromValues(1, 1, 1),
                roughness: this.tankRoughness,
                roughness_scale: 1,
                emissive: this.blackTexture,
                emissive_tint: vec3.fromValues(1, 1, 1),
                ambient_occlusion: this.tankAmbientOcclusion
            },
            texture: this.tankTexture, 
            modelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 0, -10), vec3.fromValues(1, 1, 1))
        };

        this.objects['tank2'] = {
            mesh: this.tankMesh,
            material: {
                albedo: this.tankTexture,
                albedo_tint: vec3.fromValues(0.5, 1, 0.5),
                specular: this.blackTexture,
                specular_tint: vec3.fromValues(1, 1, 1),
                roughness: this.tankRoughness,
                roughness_scale: 1,
                emissive: this.blackTexture,
                emissive_tint: vec3.fromValues(1, 1, 1),
                ambient_occlusion: this.tankAmbientOcclusion
            },
            texture: this.tankTexture, 
            modelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 0, 10), vec3.fromValues(1, 1, 1))
        };

        this.objects['bullet'] = {
            mesh: this.bulletMesh, 
            material: {
                albedo: this.bulletAlbedo,
                albedo_tint: vec3.fromValues(1, 1, 1),
                specular: this.bulletEmissive,
                specular_tint: vec3.fromValues(1, 1, 1),
                roughness: this.bulletRoughness,
                roughness_scale: 1,
                emissive: this.blackTexture,
                emissive_tint: vec3.fromValues(1, 1, 1),
                ambient_occlusion: this.bulletAmbientOcclusion
            }, 
            texture: this.blackTexture, 
            modelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 3, 0), vec3.fromValues(1, 1, 1))
        }


        

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.aspectRatio = this.gl.drawingBufferWidth/2/this.gl.drawingBufferHeight;

        this.camera2 = new Camera();
        this.camera2.type = 'perspective';
        this.camera2.aspectRatio = this.gl.drawingBufferWidth/2/this.gl.drawingBufferHeight;

        this.initializeCameraFlyController();

        this.glFinalization();

        this.gl.clearColor(0, 0, 0, 1);
    }

    
    public draw(deltaTime: number): void {
        //this.controller.update(deltaTime);


        this.listenForPlayer1Input();
        this.listenForPlayer2Input();

        this.gl.viewport(0,0,640,720);
        this.gl.scissor(0,0,640,720);
        //this.gl.clearColor(0,0,0,1);
        //this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.drawScene(this.camera)

        this.gl.viewport(640,0,640,720);
        this.gl.scissor(640,0,640,720);

        this.drawScene(this.camera2);
        //this.gl.clearColor(0,0,0,1);
        //this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        // this.idris += 0.05;

        // this.camera.position = vec3.fromValues(this.idris, this.idris, -5);
        // this.camera.direction = vec3.fromValues(this.idris, this.idris, 0);

        //throw new Error("Method not implemented.");

        
        //this.gl.disable(this.gl.SCISSOR_TEST);
        
    }
    
    public end(): void {
        for(let key in this.lightPrograms)
            this.lightPrograms[key].dispose();
        //throw new Error("Method not implemented.");
        this.program.dispose();
        this.program = null;

        this.tankMesh.dispose();
        this.groundMesh.dispose();
    }

    
    ////////////////////////////////////////////////////////



    private drawScene(_camera: Camera) {

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);


        this.program.use();

        // let VP1 = this.camera.ViewProjectionMatrix;
        // let VP2 = this.camera2.ViewProjectionMatrix;

        //let defaultCamera = this.camera; 

        // if (this.input.isKeyDown('1')) {
        //     defaultCamera = this.camera;
        // }
        // if (this.input.isKeyDown('2')) {
        //     defaultCamera = this.camera2;
        // }
        
        //let groundMat = mat4.clone(defaultCamera.ViewProjectionMatrix);
        //mat4.scale(groundMat, groundMat, [100, 1, 100]);





        // mat4.translate(this.objects['tank'].modelMatrix, this.objects['tank'].modelMatrix, this.tankPosLeft);
        // mat4.rotateY(this.objects['tank'].modelMatrix, this.objects['tank'].modelMatrix, this.tankRotYLeft);
        this.objects['tank'].modelMatrix = mat4.fromRotationTranslationScale(
            this.objects['tank'].modelMatrix, 
            quat.rotateY(quat.create(), quat.create(), this.tankRotYLeft), 
            this.tankPosLeft, 
            vec3.fromValues(1, 1, 1)
        );

        //console.log(this.objects['tank'].modelMatrix);
        //let tankMat = mat4.clone(defaultCamera.ViewProjectionMatrix);
        //mat4.mul(tankMat, this.objects['tank'].modelMatrix, tankMat);
 
        this.camera.position = vec3.fromValues(this.tankPosLeft[0]-Math.sin(this.tankRotYLeft)*5, this.tankPosLeft[1] + 5, this.tankPosLeft[2]-Math.cos(this.tankRotYLeft)*5);
        this.camera.direction = vec3.fromValues(Math.sin(this.tankRotYLeft), this.tankPosLeft[1], Math.cos(this.tankRotYLeft));

        //console.log(this.bullets.length);


        this.objects['tank2'].modelMatrix = mat4.fromRotationTranslationScale(
            this.objects['tank2'].modelMatrix, 
            quat.rotateY(quat.create(), quat.create(), this.tankRotYRight), 
            this.tankPosRight, 
            vec3.fromValues(1, 1, 1)
        );

        this.camera2.position = vec3.fromValues(this.tankPosRight[0]-Math.sin(this.tankRotYRight)*5, this.tankPosRight[1] + 5, this.tankPosRight[2]-Math.cos(this.tankRotYRight)*5);
        this.camera2.direction = vec3.fromValues(Math.sin(this.tankRotYRight), this.tankPosRight[1], Math.cos(this.tankRotYRight));

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

        // this.program.setUniform2f("tiling_factor", [1, 1]);
        // this.program.setUniformMatrix4fv("MVP", false, tankMat);
        // this.program.setUniform4f("tint", [1, 1, 1, 1]);
        
        // this.drawTexture(this.tankTexture, this.universalSampler);
        // this.tankMesh.draw(this.gl.TRIANGLES);

        // this.program.setUniform2f("tiling_factor", [1, 1]);
        // this.program.setUniformMatrix4fv("MVP", false, tankMat2);
        // this.program.setUniform4f("tint", [1, 1, 1, 1]);
        
        // this.drawTexture(this.tankTexture, this.universalSampler);
        // this.tankMesh.draw(this.gl.TRIANGLES);
        
        // this.program.setUniform2f("tiling_factor", [.1, .1]);
        // this.program.setUniformMatrix4fv("MVP", false, groundMat);
        // this.program.setUniform4f("tint", [0.93, 0.91, 0.69, 1]);

        // this.drawTexture(this.groundTexture, this.universalSampler);
        // this.groundMesh.draw(this.gl.TRIANGLES);

        let first_light = true;
        // for each light, draw the whole scene
        for(const light of this.lights){
            if(!light.enabled) continue; // If the light is not enabled, continue

            if(first_light){ // If tihs is the first light, there is no need for blending
                this.gl.disable(this.gl.BLEND);
                first_light = false;
            }else{ // If this in not the first light, we need to blend it additively with all the lights drawn before
                this.gl.enable(this.gl.BLEND);
                this.gl.blendEquation(this.gl.FUNC_ADD);
                this.gl.blendFunc(this.gl.ONE, this.gl.ONE); // This config will make the output = src_color + dest_color
            }

            let program = this.lightPrograms[light.type]; // Get the shader to use with this light type
            program.use(); // Use it

            // Send the VP and camera position
            program.setUniformMatrix4fv("VP", false, _camera.ViewProjectionMatrix);
            program.setUniform3f("cam_position", _camera.position);

            // Send the light properties depending on its type (remember to normalize the light direction)
            if(light.type == 'ambient'){
                program.setUniform3f(`light.skyColor`, light.skyColor);
                program.setUniform3f(`light.groundColor`, light.groundColor);
                program.setUniform3f(`light.skyDirection`, light.skyDirection);
            } else {
                program.setUniform3f(`light.color`, light.color);
                
                if(light.type == 'directional' || light.type == 'spot'){
                    program.setUniform3f(`light.direction`, vec3.normalize(vec3.create(), light.direction));
                }
                if(light.type == 'point' || light.type == 'spot'){
                    program.setUniform3f(`light.position`, light.position);
                    program.setUniform1f(`light.attenuation_quadratic`, light.attenuation_quadratic);
                    program.setUniform1f(`light.attenuation_linear`, light.attenuation_linear);
                    program.setUniform1f(`light.attenuation_constant`, light.attenuation_constant);
                }
                if(light.type == 'spot'){
                    program.setUniform1f(`light.inner_cone`, light.inner_cone);
                    program.setUniform1f(`light.outer_cone`, light.outer_cone);
                }
            }

            // Loop over objects and draw them
            for(let name in this.objects){
                let obj = this.objects[name];

                program.setUniform2f("tiling_factor", [1, 1]);

                if (name == 'ground') {
                    program.setUniform2f("tiling_factor", [0.2, 0.2]);
                }

                if (name != 'bullet') {
                    // Create model matrix for the object
                    program.setUniformMatrix4fv("M", false, obj.modelMatrix);
                    program.setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), obj.modelMatrix));
                    
                    this.drawMaterials(program, obj);
                    
                    // Draw the object
                    obj.mesh.draw(this.gl.TRIANGLES);
                } else {
                    for (let i = 0; i < this.bullets.length; i++) {
                        // Create model matrix for the object
                        this.bullets[i].modelMat = mat4.translate(mat4.create(), this.bullets[i].modelMat, vec3.fromValues(Math.sin(this.bullets[i].orientationY)/40, 0, Math.cos(this.bullets[i].orientationY)/40))
                        program.setUniformMatrix4fv("M", false, this.bullets[i].modelMat);
                        program.setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), this.bullets[i].modelMat));
                        
                        this.drawMaterials(program, obj);
                        
                        // Draw the object
                        obj.mesh.draw(this.gl.TRIANGLES);
                    }
                }
            }   
        }
    }


    private drawMaterials(program: ShaderProgram, obj: Object3D) {
        // Send material properties and bind the textures
        program.setUniform3f("material.albedo_tint", obj.material.albedo_tint);
        program.setUniform3f("material.specular_tint", obj.material.specular_tint);
        program.setUniform3f("material.emissive_tint", obj.material.emissive_tint);
        program.setUniform1f("material.roughness_scale", obj.material.roughness_scale);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, obj.material.albedo);
        this.gl.bindSampler(0, this.universalSampler);
        program.setUniform1i("material.albedo", 0);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, obj.material.specular);
        this.gl.bindSampler(1, this.universalSampler);
        program.setUniform1i("material.specular", 1);

        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D, obj.material.roughness);
        this.gl.bindSampler(2, this.universalSampler);
        program.setUniform1i("material.roughness", 2);

        this.gl.activeTexture(this.gl.TEXTURE3);
        this.gl.bindTexture(this.gl.TEXTURE_2D, obj.material.emissive);
        this.gl.bindSampler(3, this.universalSampler);
        program.setUniform1i("material.emissive", 3);

        this.gl.activeTexture(this.gl.TEXTURE4);
        this.gl.bindTexture(this.gl.TEXTURE_2D, obj.material.ambient_occlusion);
        this.gl.bindSampler(4, this.universalSampler);
        program.setUniform1i("material.ambient_occlusion", 4);
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
        //this.gl.enable(this.gl.CULL_FACE);
        //this.gl.cullFace(this.gl.BACK);
        //this.gl.frontFace(this.gl.CW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.enable(this.gl.SCISSOR_TEST);

    }

    ////////////////////////////////////////////////////////

    private initializeUniversalSampler() {
        this.universalSampler = this.gl.createSampler();
        this.initializeSampler(this.universalSampler);
    }

    private initializeTankTexture() {
        this.tankTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tankTexture);
        this.initializeTexture("tank-texture");
    }

    private initializeGroundTexture() {
        this.groundTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.groundTexture);
        this.initializeTexture("ground-texture");
    }

    private initializeTankNormal() {
        this.tankNormal = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tankNormal);
        this.initializeTexture("tank-texture-normal");
    }

    private initializeTankAmbientOcclusion() {
        this.tankAmbientOcclusion = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tankAmbientOcclusion);
        this.initializeTexture("tank-texture-ambient-occlusion");
    }

    private initializeTankRoughness() {
        this.tankRoughness = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tankRoughness);
        this.initializeTexture("tank-texture-roughness");
    }


    private initializeGroundAlbedo() {
        this.groundAlbedo = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.groundAlbedo);
        this.initializeTexture("ground-texture-albedo");
    }

    private initializeGroundNormal() {
        this.groundNormal = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.groundNormal);
        this.initializeTexture("ground-texture-normal");
    }

    private initializeGroundRoughness() {
        this.groundRoughness = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.groundRoughness);
        this.initializeTexture("ground-texture-roughness");
    }

    private initializeBulletAlbedo() {
        this.bulletAlbedo = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bulletAlbedo);
        this.initializeTexture("bullet-texture-albedo");
    }

    private initializeBulletNormal() {
        this.bulletNormal = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bulletNormal);
        this.initializeTexture("bullet-texture-normal");
    }

    private initializeBulletRoughness() {
        this.bulletRoughness = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bulletRoughness);
        this.initializeTexture("bullet-texture-roughness");
    }
    
    private initializeBulletEmissive() {
        this.bulletEmissive = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bulletEmissive);
        this.initializeTexture("bullet-texture-emissive");
    }
        
    private initializeBulletAmbientOcclusion() {
        this.bulletAmbientOcclusion = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.bulletAmbientOcclusion);
        this.initializeTexture("bullet-texture-ambient-occlusion");
    }


    private initializeCameraFlyController() {
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.005;
    }

    private listenForPlayer1Input() {
        if (this.input.isKeyDown('w')) {
            let dis = this.getTankDistance();

            this.tankPosLeft[2] += Math.cos(this.tankRotYLeft) * 0.135;
            this.tankPosLeft[0] += Math.sin(this.tankRotYLeft) * 0.135;
            
            let otherdist =  this.getTankDistance();
            
            if(dis<this.tank_collision_threshold && otherdist<dis){
                this.tankPosLeft[2] -= Math.cos(this.tankRotYLeft) * 0.135;
                this.tankPosLeft[0] -= Math.sin(this.tankRotYLeft) * 0.135;
            }
        }

        if (this.input.isKeyDown('s')) {
            let dis = this.getTankDistance();
            
            this.tankPosLeft[2] -= Math.cos(this.tankRotYLeft) * 0.135;
            this.tankPosLeft[0] -= Math.sin(this.tankRotYLeft) * 0.135;
            let otherdist =  this.getTankDistance();
            
            if(dis<this.tank_collision_threshold && otherdist<dis){
                this.tankPosLeft[2] += Math.cos(this.tankRotYLeft) * 0.135;
                this.tankPosLeft[0] += Math.sin(this.tankRotYLeft) * 0.135;
            }   
        }

        if (this.input.isKeyDown('a')) {
            this.tankRotYLeft+= 0.035;
        }

        if (this.input.isKeyDown('d')) {
            this.tankRotYLeft-= 0.035;
        }

        if (this.input.isKeyDown(' ')) {
            // Add bullet to array
            let m :mat4 = mat4.translate(mat4.create(), mat4.create() , this.tankPosRight);
            this.bullets.push({modelMat: /*this.objects['tank2'].modelMatrix*/ m, orientationY:this.tankRotYRight, owner : "rightPlayer"});

        } 

        if(this.tankPosLeft[0]>97.5){
            this.tankPosLeft[0]=97.5;
        }
        if(this.tankPosLeft[0] < -97.5){
            this.tankPosLeft[0]= -97.5;
        }
        if(this.tankPosLeft[2]>97.5){
            this.tankPosLeft[2]=97.5;
        }
        if(this.tankPosLeft[2]< -97.5){
            this.tankPosLeft[2]= -97.5;
        }
    }

    private listenForPlayer2Input() {
        if (this.input.isKeyDown(Key.ArrowUp)) {
            let dis = this.getTankDistance();

            this.tankPosRight[2] += Math.cos(this.tankRotYRight) * 0.135;
            this.tankPosRight[0] += Math.sin(this.tankRotYRight) * 0.135;

            let otherdist =  this.getTankDistance();
            
            if(dis<this.tank_collision_threshold && otherdist<dis){
                this.tankPosRight[2] -= Math.cos(this.tankRotYRight) * 0.135;
                this.tankPosRight[0] -= Math.sin(this.tankRotYRight) * 0.135;
            }
        }

        if (this.input.isKeyDown(Key.ArrowDown)) {
            let dis = this.getTankDistance();
            
            
            this.tankPosRight[2] -= Math.cos(this.tankRotYRight) * 0.135;
            this.tankPosRight[0] -= Math.sin(this.tankRotYRight) * 0.135;
            let otherdist =  this.getTankDistance();
            
            if(dis<this.tank_collision_threshold && otherdist<dis){
                this.tankPosRight[2] += Math.cos(this.tankRotYRight) * 0.135;
                this.tankPosRight[0] += Math.sin(this.tankRotYRight) * 0.135;
            }   
            
        }

        if (this.input.isKeyDown(Key.ArrowLeft)) {
            this.tankRotYRight+= 0.035;
        }

        if (this.input.isKeyDown(Key.ArrowRight)) {
            this.tankRotYRight-= 0.035;
        }

        if (this.input.isKeyDown(Key.Shift)) {
            // Add bullet to array
            //let R: quat = quat.rotateX(quat.create(), quat.create(), 90 * 180/Math.PI);
            //let M: mat4 = mat4.fromRotationTranslationScale(
            //    mat4.create(), 
            //    quat.rotateY(quat.create(), quat.rotateX(quat.create(), quat.create(), 90 * Math.PI/180), this.tankRotYRight), 
            //    vec3.fromValues(this.tankPosLeft[0], this.tankPosLeft[1] + 2, this.tankPosLeft[2]), 
            //    vec3.fromValues(1, 1, 1)
            //);
            //console.log(this.tankPosLeft);
            ////let M: mat4 = mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 3, 0), vec3.fromValues(1, 1, 1));
            ////let M: mat4 = mat4.
            //this.bullets.push({modelMat: M/*mat4.create()*/ , orientationY:this.tankRotYRight , owner : "rightPlayer"});
            let m :mat4 = mat4.translate(mat4.create(), mat4.create() , this.tankPosLeft);
            this.bullets.push({modelMat: /*this.objects['tank2'].modelMatrix*/ m,orientationY:this.tankRotYLeft, owner : "leftPlayer"});
        } 

        if(this.tankPosRight[0]>97.5){
            this.tankPosRight[0]=97.5;
        }
        if(this.tankPosRight[0] < -97.5){
            this.tankPosRight[0]= -97.5;
        }
        if(this.tankPosRight[2]>97.5){
            this.tankPosRight[2]=97.5;
        }
        if(this.tankPosRight[2]< -97.5){
            this.tankPosRight[2]= -97.5;
        }
    }
    private getTankDistance(): number{
        let x = vec3.dist(this.tankPosLeft,this.tankPosRight);
        return x;
    }
}
