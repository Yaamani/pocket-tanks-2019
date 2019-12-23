#version 300 es
// The line above should always be the first thing in the file (you shouldn't even have a new line before it)
// It defines the supported version of GLSL

// The next line defines an attribute and its location in the attribute layout
layout(location=0) in vec3 position;

// This main function is run once for each vertex
void main(){
    // Here we add a homogenous component to our vertex position (for 2D it must be 1.0f) then we pass it to the builtin variable gl_Position
    gl_Position = vec4(position, 1.0f);
}