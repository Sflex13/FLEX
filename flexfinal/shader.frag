precision highp float; 
varying vec2  vTexCoord; 
uniform vec2 u_resolution; 
uniform float u_time; 
uniform float u_level; 
uniform int u_active_theme; 
uniform float u_uncertain; 
uniform sampler2D u_text; 
uniform float u_expand; // 0: normal strip 1: full screen
uniform float u_rise; // 0: no letters, 1 letters risen as hills

// intro lettering as glass: how strongly the letters bend the terrain behind them
const float GLASS_BEND = 0.9; 

#define RGB(r, g, b) vec3(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0)

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0) + 1.0) * x);  }

float snoise(vec2 v) { 
    const vec4 C = vec4(0.2113248, 0.3660254, -0.5773502, 0.0243902); 
    vec2 i = floor( v + dot(v, C.yy)); 
    vec2 x0 = v - i + dot(i, C.xx); 
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0) ;
    vec4 x12 = x0.xyxy + C.xxzz; 
    x12.xy -= i1; 
    i = mod289(i); 
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)); 
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0); 
    m = m*m; m = m*m; 
    vec3 x = 2.0 * fract( p *C.www) - 1.0; 
    vec3 h = abs(x) - 0.5; 
    vec3 a0 = x - floor( x+ 0.5); 
    m *= 1.7928429 - 0.8537347 * (a0*a0 + h*h);
    vec3 g; 
    g.x = a0.x * x0.x + h.x * x0.y; 
    g.yz = a0.yz * x12.xz + h.yz * x12.yw; 
    return 130.0 * dot(m, g); 

}

vec3 colorMix(vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5, float v) { 
    float s = clamp(v, 0.0, 1.0) * 4.0; 
    vec3 col = mix(c1, c2, clamp(s, 0.0, 1.0)); 
    col = mix(col, c3, clamp(s -1.0, 0.0, 1.0)); 
    col = mix(col, c4, clamp(s -2.0, 0.0, 1.0)); 
    col = mix(col, c5, clamp(s -3.0, 0.0, 1.0)); 
    return col; 
    
}

// aynı alan değerini (v) istenen konumda yeniden hesaplamak için 
float fieldV(vec2 fbmUv, float t) { 
    float v1 = snoise (fbmUv + vec2(t * 0.09, t * 0.03)) * 0.5 + 0.5; 
    float v2 = snoise( fbmUv * 1.85 + vec2(t * 0.14 + 4.7, t * 0.05 + 2.3)) * 0.5 + 0.5; 
    return v1 * 0.72 + v2 * 0.28; 
}

void main() { 
    vec2 uv = gl_FragCoord.xy / u_resolution.xy; 
    float mixLevel = clamp(u_level / 3.0, 0.0, 1.0);

    vec3 bgColor = RGB(10, 10, 14); 

    // add mask abla 
    float stripH = mix(160.0 / u_resolution.y, 1.4, u_expand);
    float dist = abs(uv.y - 0.5); 
    float edge = stripH * 0.5; 
    float mask = 1.0 - smoothstep(edge - 0.055, edge, dist); 
    float maskX = smoothstep( 0.01, 0.06, uv.x) * (1.0 - smoothstep(0.94, 0.99, uv.x)); 
    maskX = mix(maskX, 1.0, u_expand); 
    mask *= maskX; 

    //outside the strip nothing is visible: skip all noise work (big speed-up)
    if (mask < 0.002) { 
        gl_FragColor = vec4(bgColor, 1.0); 
        return; 
    }

    // gaussian efekt 
    float yNorm = (uv.y - 0.5) / (stripH * 0.5); 
    float glowY = exp(-yNorm * yNorm * 3.5); 
    float glowX = 1.0 - smoothstep(0.0, 0.35, abs(uv.x - 0.5)); 
    float glow = glowY * (0.55 + glowX * 0.45); 

    // flex lettering as glass ( texture r = crisp silüet, g = soft pillow height, b = medium bevel)
    float textW = 0.78; 
    float textH = textW * (u_resolution.x / u_resolution.y) / 4.0; 
    vec2 tuv = (uv - 0.5) / vec2(textW, textH) + 0.5; 
    float sil = 0.0; 
    float tx = 0.0; 
    float shadow = 0.0; 
    vec2 tgrad = vec2(0.0); 
    vec2 rimGrad = vec2(0.0); 
    if(u_rise > 0.001 && tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) { 
        vec2 tc = vec2(tuv.x, 1.0 - tuv.y); 
        vec2 eG = vec2(6.0 / 2048.0, 6.0 /512.0); 
        vec2 eB = vec2(3.0 / 2048.0, 3.0/ 512.0);
        vec4 t0 = texture2D(u_text, tc); 
        sil = t0.r; 
        tx = t0.g; 
        tgrad = vec2(texture2D(u_text, tc + vec2(eG.x, 0.0)).g - texture2D(u_text, tc - vec2(eG.x, 0.0)).g, 
        -(texture2D(u_text, tc + vec2(0.0, eG.y)).g - texture2D(u_text, tc - vec2(0.0, eG.y)).g)); 
        rimGrad = vec2(texture2D(u_text, tc + vec2(eB.x, 0.0)).b - texture2D(u_text, tc - vec2(eB.x, 0.0)).b,
        -(texture2D(u_text, tc + vec2(0.0, eB.y)).b - texture2D(u_text, tc - vec2(0.0, eB.y)).b)); 
        shadow = texture2D(u_text, tc - vec2(14.0 / 2048.0, 22.0 / 512.0)).g; 
    }

    //topofrafik efekt
    float ns = mix(2.2, 3.8, mixLevel); 
    vec2 fbmUv = vec2(uv.x * ns, (uv.y - 0.5) * ns * 2.2); 
    fbmUv += tgrad * (GLASS_BEND * u_rise);  // refraction: contour bend where the glass is
    float t = u_time; 
    float v1 = snoise(fbmUv + vec2(t * 0.09, t * 0.03)) * 0.5 + 0.5; 
    float v2 = snoise(fbmUv * 1.85 + vec2(t * 0.14 + 4.7, t * 0.05 + 2.3)) * 0.5 + 0.5; 
    float v = v1 * 0.72 + v2 * 0.28; 

    // colour themes: 0 sunset, 1 arctic, 2 aurora 
    vec3 calm, stress, lineCol; 

    if(u_active_theme == 0) { 
        //sunset 
        calm   = colorMix(RGB(252, 246, 230), RGB(244, 222, 168), RGB(230, 178, 88), RGB(208, 124, 38), RGB(162, 72, 12), v) ; 
        stress = colorMix(RGB(15, 25, 68), RGB(28, 52, 125), RGB(48, 105, 192), RGB(105, 168, 238), RGB(188, 222, 255), v);
        lineCol = mix(RGB(148, 82, 14), RGB(148, 198, 255), mixLevel); 
    }
    else if (u_active_theme == 1) { 
        // arctic 
        calm   = colorMix(RGB(246, 249, 253), RGB(212, 227, 240), RGB(158, 190, 220), RGB(98, 148, 192), RGB(48, 95, 150),v); 
        stress = colorMix(RGB(82, 36, 6), RGB(148, 66, 8), RGB(212, 108, 16), RGB(250, 160, 42), RGB(255, 218, 118), v); 
        lineCol = mix(RGB(178, 208, 232), RGB(242, 132, 26), mixLevel); 
    }
    else { 
        //aurora 
        calm   = colorMix(RGB(8, 6, 28), RGB(16, 12, 48), RGB(28,20,72), RGB(18, 38, 65), RGB(12, 52, 68), v); 
        stress = colorMix(RGB(50, 30, 10), RGB(90, 58, 12), RGB(145, 95, 18), RGB(200, 145, 30), RGB(255, 210, 90), v); 
        lineCol = mix(RGB(42, 30, 95), RGB(200,145, 30), mixLevel); 
    }

vec3 baseColor = mix(calm, stress, mixLevel); 

// belirsizlik hali 
vec3 uncBase = RGB(26, 36, 72) * 0.85; 
vec3 uncLine = RGB(240, 122, 6) * 0.70; 
float uncLines = 0.0; 
if ( u_uncertain > 0.001) { // 4 extra noise calls per pixel only while needed
float uncBands = 12.0; 
float unPhase = fract( v * uncBands); 
vec2 px       = 1.0/ u_resolution.xy; 
float vx      = fieldV(fbmUv + vec2( ns * px.x, 0.0), t); 
float vy      = fieldV(fbmUv + vec2(0.0, ns * 2.2 * px.y), t); 
float uncW    = max((abs(vx - v) + abs(vy - v)) * uncBands, 0.0005); 
uncLines      = 1.0 - smoothstep(uncW * 0.8, uncW * 1.6, abs(unPhase - 0.5)); 

}

// topografik çizgiler 
float bandCount = mix(3.0, 5.0, mixLevel); 
float linePhase = fract(v * bandCount); 
float lineThick = mix(0.025, 0.038, mixLevel); 
float lines     = smoothstep(lineThick + 0.003, lineThick, abs(linePhase - 0.5)); 
float lineAlpha = mix(0.60, 0.88, mixLevel) * (0.6 + glow * 0.4); 

// seviye 3 
// soldurma 
if ( u_level > 2.5) { 
   float fade = mix(1.0, 0.22, (u_level - 2.5) / 0.5); 
   baseColor *= fade; 
   lineAlpha *= fade; 
}

// renklerle çizgi birleştirme 
vec3 themeFluid = mix(baseColor, lineCol, lines * lineAlpha); 
float glowStrength = mix(0.18, 0.32, mixLevel); 
themeFluid += baseColor * glow * glowStrength; 

vec3 uncFluid = mix(uncBase, uncLine, uncLines * 0.45); 
uncFluid += uncBase * glow * 0.12; 

float unc = smoothstep(0.0, 1.0, u_uncertain); 
vec3 fluid = mix (themeFluid, uncFluid, unc); 

// intro keep the full-screen state dimmer and vignetted, so it reads as light in a dark cabin
float aspect = u_resolution.x / u_resolution.y;
float vig = 1.0 - 0.65 * smoothstep(0.30, 0.95, length((uv - 0.5) * vec2(aspect, 1.0))); 
fluid *= mix(1.0, 0.62 * vig, u_uncertain); 

// clean glass shading 
vec3 clearView = fluid; 
float body = sil * u_rise;
fluid *= mix(1.0, 0.70, u_rise); 
fluid *= 1.0 - shadow * (1.0 -sil) * 0.55 * u_rise; 
vec3 glass = clearView * vec3(1.06, 0.97, 0.82) + 0.04; 
glass *= 1.0 + 0.15 * smoothstep(0.2, 0.9, tx); 
fluid = mix(fluid, glass, body); 

float rimMag = length(rimGrad); 
vec2 rn      = rimGrad / (rimMag + 0.0001); 
vec2 L       = normalize(vec2(-0.55, 0.85)); 
float rim    = smoothstep(0.04, 0.22, rimMag) * sil; 
float lit    = pow(clamp(dot(-rn, L), 0.0, 1.0), 2.0); 
float back   = pow(clamp(dot(rn, L), 0.0, 1.0), 2.0);
fluid       += vec3(1.0, 0.97, 0.90) * rim * (0.10 + 0.7500 * lit + 0.30 * back) * u_rise; 

// maske aticak
vec3 finalColor = mix(bgColor, fluid, mask); 
gl_FragColor = vec4(finalColor, 1.0);

}
