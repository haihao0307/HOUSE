uniform sampler2D scene;out vec4 outColor;
void main(){outColor=vec4(texelFetch(scene,ivec2(gl_FragCoord.xy),0).rgb,1.);}
