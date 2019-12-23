import Mesh from './mesh';
import ShaderProgram from '../common/shader-program';
import { vec3, mat4 } from 'gl-matrix';
import {ResourceInfo} from '../common/loader';
import {Scene} from '../common/game'


export default class Object3D {
    scene: Scene;

    modelName: string;
    textureName: string;
    modelResInfo: ResourceInfo;
    textureResInfo: ResourceInfo;


    mesh: Mesh;
    tankTexture: WebGLTexture;

    VAO: WebGLVertexArrayObject; // Vertex Array Object: This will store how the GPU will read our buffer to draw the triangle 
    VBO: WebGLBuffer; // Vertex Buffer Object: This will store the vertex data of our triangle
    
    public constructor(scene: Scene, 
        modelName: string, 
        modelResInfo: ResourceInfo, 
        textureName: string, 
        textureResInfo: ResourceInfo) {

        this.scene = scene;

        this.modelName = modelName;
        this.textureName = textureName;
        
        this.modelResInfo = modelResInfo;
        this.textureResInfo= textureResInfo;
    }

    public load(): void {
        this.scene.game.loader.load(
            {
                [this.modelName]: this.modelResInfo, 
                [this.textureName]: this.textureResInfo
            }
        );
    }
}

