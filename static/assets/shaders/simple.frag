#version 300 es
// ifdef GL_ES
// precision mediump float;
// endif

precision highp float; // Here we define the precision of our floats as high precision (highp). Choose mediump or lowp for older hardware

out vec4 color; // This will be the output of the shader. Whatever we write here will be drawn on the frame buffer (the screen)

void main(){
    // Just draw white
    color = vec4(1.0f, 1.0f, 1.0f, 1.0f);
}