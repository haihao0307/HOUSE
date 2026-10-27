uniform sampler2D previousScene,tileColor;uniform bool firstTile;out vec4 outScene;
void main(){ivec2 xy=ivec2(gl_FragCoord.xy);vec4 t=texelFetch(tileColor,xy,0),p=firstTile?vec4(t.rgb,1e9):texelFetch(previousScene,xy,0);outScene=t.a<p.a?t:p;}
