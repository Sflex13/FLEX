// flex interactive prototype in 3 themes 

// tunabke design constants
const TAU_LEVEL = 1.1; 
const TAU_UNCERTAIN = 1.0; //seconds easing the time constant for level changes
const SPEED_MIN = 0.00008; // motion speed at level 0 (per frame at 60 fps)
const SPEED_MAX = 0.0002; // motion speed at level 3 fastest for design choice 
const STORY = [           // STORY MODE 
 { level: 0, secs: 7},
{ level: 1, secs: 8},
{ level: 2, secs: 8},
{ level: 3, secs: 10},
]; 

const THEMES = {
    en: ["Sunset", "Arctic", "Aurora"],
    tr: ["Gün Batımı", "Arktik", "Aurora"]
};

const LEVELS = {
    en:["Level 0 — Baseline · Calm",  "Level 1 — Mild deviation", "Level 2 — High cognative load", "Level 3 — Quiet Storm"],
    tr:["Level 0 — Referans · Sakin", "Level 1 — Hafif Sapma",    "Level 2 — Yüksek Bilişsel Yük", "Level 3 — Quiet Storm"]
};

const LABELS = {
    en: {level: "level", story: "Play story", stop: "Stop story", theme: "Theme", hide: "Hide interface", lang: "TR",
        unc: "Can't read", uncStatus: "FLEX can't read you right now",
        intro: "A mirror, not an alarm",
        keys: "0—3 level · T theme · U can't read · Space story · H hide"
    },
    tr: {level: "Seviye", story: "Hikayeyi oynat", stop: "Hikayeyi durdur", theme: "Tema", hide: "Arayüzü gizle", lang: "EN",
        unc: "Okuyamıyor", u_uncertain: "FLEX şu an seni okuyamıyor",
        intro: "Bir alarm değil bir ayna",
        keys: "0—3 level · T tema · U okuyamıyor · Boşluk hikaye · H gizle"
    }
};

// State 
let ledShader; 
let targetLevel = 0,     smoothLevel= 0, timeVal = 0, activeTheme = 0;
let uncertainTarget = 0, smoothUncertain = 0; 
let lang = "en"; 
let storyOn = false, storyIdx = 0, storyStart = 0; 

// intro state kısmı 
let introState = "off"; // off | wait | run | skip
let introStart = 0, skipStart= 0, skipRise = 0, skipExpand = 0; 
let introRise = 0; introExpand = 0; introBoost = 1;
let textImg; 

const ease = x => x * x * (3.0 - 2.0 * x); 
const prog = (t, a, b) => constrain((t - a ) / ( b - a), 0, 1);

function preload() { 
    ledShader = loadShader("shader.vert", "shader.frag"); 
}

function setup() { 
    pixelDensity(1);  // speed up yapmamak için
    createCanvas(windowWidth, windowHeight, WEBGL); 
    noStroke(); 
    buildInterface(); 
    refreshInterface();

    textImg = createImage(1, 1);  // empty mask at font hazır olasıya kdr 
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)"). matches; 
    if (new URLSearchParams(location.search).get("intro") !== "0" && !reduced) startIntro(); 
    else document.body.classList.remove("intro");
}

function draw() { 
    background(10, 10, 14); 
    const dt = Math.min(deltaTime, 100);   // ms, clamped after tab switchesss

    if(storyOn) advanceStory(); 
    updateIntro(); 

    // frame rate independent easing and motioon
    smoothLevel += (targetLevel - smoothLevel) * (1 - Math.exp(-(dt / 1000) / TAU_LEVEL)); 
    smoothUncertain += (uncertainTarget - smoothUncertain) * ( 1- Math.exp(-(dt / 1000) / TAU_UNCERTAIN)); 
    timeVal += lerp(SPEED_MIN, SPEED_MAX, smoothLevel / 3) * ( dt / 16.667) * (1 - smoothUncertain) * introBoost; 
    
    shader(ledShader); 
    ledShader. setUniform("u_resolution", [width, height]); 
    ledShader. setUniform("u_time",timeVal * 100.0);
    ledShader. setUniform("u_level", smoothLevel);
    ledShader. setUniform("u_active_theme", activeTheme); 
    ledShader. setUniform("u_uncertain", smoothUncertain);
    ledShader. setUniform("u_text", textImg);
    ledShader. setUniform("u_expand", introExpand);   
    ledShader. setUniform("u_rise", introRise); 
    rect(0, 0, width, height); 

}


// story mode 
function startStory() { 
    storyOn = true; storyIdx = 0; storyStart = millis(); 
    targetLevel = STORY[0].level; 
    refreshInterface(); 
    
}

function stopStory() { storyOn = false; refreshInterface(); }
function advanceStory() { 
    if((millis() - storyStart) / 1000 >= STORY[storyIdx].secs) { 
        storyIdx = (storyIdx + 1) % STORY.length;
        targetLevel = STORY[storyIdx].level; 
        storyStart = millis(); 
        refreshInterface(); 
    }
}

// introcuk 
function makeTextMask() { 
    const W = 2048, H = 512; 
    const mk = (blurPx) => { 
        const g = createGraphics(W, H); 
        g.pixelDensity(1); 
        g.background(0); 
        g.fill(255); g.noStroke();
        g.textFont("Syncopate"); 
        g.textStyle(BOLD); 
        g.textAlign(CENTER, CENTER); 
        g.textSize(380); 
        g.text("flex", W / 2, H / 2); 
        if(blurPx > 0) g.filter(BLUR, blurPx); 
        g.loadPixels(); 
        return g;  
    }; 
    const sharp = mk(1), mid = mk(5), soft = mk(22); 
    const out = createImage(W, H); 
    out.loadPixels();; 
    for ( let i = 0; i < W * H * 4; i += 4) { 
        out.pixels[i]       = sharp.pixels[i];  // R: Crisp siliuet 
        out.pixels[i + 1]   = soft.pixels[i];  // g: soft pillow height ( refraction)
        out.pixels[i + 2]   = mid.pixels[i];  // b: medium bevel (edge light)
        out.pixels[i + 3]   = 255; 
        
    }
    out.updatePixels(); 
    textImg = out; 
    sharp.remove(); mid.remove(); soft.remove(); 
}

function startIntro() { 
    document.body.classList.add("intro"); 
    introState = "wait"; 
    introExpand = 0; 
    const timeout = new Promise( r => setTimeout(r, 2500)); 
    Promise.race([document.fonts.load('700 100px "Syncopate"'), timeout]).then(() => { 
        if( introState !== "wait") return;  // skipped while waiting 
        makeTextMask(); 
        introState = "run"; 
        introStart = millis(); 
    }); 
}


function skipIntro() { 
    if (introState === "wait") {endIntro(); return; }
    if (introState !== "run")  return; 
    introState = "skip"; 
    skipStart = millis(); skipRise = introRise; skipExpand = introExpand; 
    introBoost = 1; 
        
}

function endIntro() { 
    introState = "off", introRise = 0; introExpand = 0; introBoost = 1; 
    document.body.classList.remove("intro"); 
    document.getElementById("intro-line").classList.remove("on"); 
}

function updateIntro() { 
    const line = document.getElementById("intro-line"); 
    if ( introState === "run") { 
        const t = millis() - introStart; 
        const down = ease(prog(t, 4200, 5400)); 
        introExpand = ease(prog(t, 0, 1200)) * (1 - down); 
        introRise = ease(prog(t, 1000, 2400)) * (1 - down); 
        introBoost = 1 + 5 * ( 1 - ease(prog(t, 0, 2500))); 
        line.classList.toggle("on", t > 5000 && t < 7200 ); 
        document.body.classList.toggle("intro", t < 7000); 
        if ( t > 8000) endIntro(); 
    } else if ( introState === "skip") { 
        const p = ease(prog(millis() - skipStart, 0, 700)); 
        introRise = skipRise * ( 1 - p); 
        introExpand = skipExpand * (1 - p); 
        line.classList.remove("on"); 
        document.body.classList.remove("intro"); 
        if( p >= 1) endIntro();
    }
}

// inputt 
function setLevel(l) {storyOn = false;  targetLevel = l; refreshInterface(); }
function setTheme(t) {activeTheme = ( t + THEMES.en.length) % THEMES.en.length;  refreshInterface(); }
function toggleUncertain() { uncertainTarget = uncertainTarget ? 0: 1; refreshInterface(); }

function mousePressed() { skipIntro(); }

function keyPressed() { 
    // any key skips the intro 
    if ( introState === "wait" || introState === "run") { skipIntro(); return false; }


    // let a focused button handle its own Space/ Enter (keyboard accesibility)
    const onBtn = document.activeElement && document.activeElement.tagName === "BUTTON"; 
    if ( onBtn && ( key === " " || keyCode === ENTER)) return; 
    if ( key >= "0" && key <= "3") setLevel(int(key)); 
    else if (key ==="t" || key === "T" || keyCode === RIGHT_ARROW) setTheme(activeTheme +1); 
    else if (keyCode === LEFT_ARROW) setTheme(activeTheme -1); 
    else if( key === " ") {storyOn ? stopStory() : startStory(); return false; }
    else if (key === "h"|| key === "H") toggleHud(); 
    else if(key === "l" || key === "L") {lang = lang === "en" ? "tr" : "en";  refreshInterface(); }
    else if ( key === "r" || key ==="R") {storyOn = false;  targetLevel = 0; activeTheme = 0; refreshInterface(); }
    else if ( key === "u" || key === "U") toggleUncertain(); 

}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }


// interfacec (DOM)
function el(tag, attrs = {}, text = "") {
    const e = document.createElement(tag); 
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, v)); 
    if ( text ) e.textContent = text; 
    return e; 
}
function toggleHud() { document.getElementById("hud").classList.toggle("hidden"); }

function buildInterface() { 
    const bar = document.getElementById("levelbar"); 
    for ( let i = 0; i < 4 ; i++) { 
        const b = el("button", {class: "btn level", "data-level": i, type: "button"}); 
        b.addEventListener("click", () => setLevel(i)); 
        bar.appendChild(b);
    }

    const sep = el("span", { class: "sep", "aria-hidden": "true"});  bar.appendChild(sep); 
    const story = el("button", {id: "storybtn", class: "btn", type : "button"}); 
    story.addEventListener("click", () => (storyOn ? stopStory() : startStory())); 
    bar.appendChild(story); 
    const unc = el("button", { id: "uncbtn", class: "btn", type: "button"}); 
    unc.addEventListener("click", toggleUncertain);
    bar.appendChild(unc); 
    const prev = el("button", { class: "btn small", type: "button", "aria-label": "Previous theme"}, "‹");
    const next = el("button", { class: "btn small", type: "button", "aria-label": "Next theme"},"›" );
    prev.addEventListener("click", () => setTheme(activeTheme -1)); 
    next.addEventListener("click", () => setTheme(activeTheme +1)); 
    bar.appendChild(prev); bar.appendChild(next); 
    const langBtn = el("button", { id : "langbtn", class: "btn small", type: "button"});
    langBtn.addEventListener("click", () => { lang = lang === "en" ? "tr" : "en"; refreshInterface(); }); 
    bar.appendChild(langBtn); 
    const hide = el("button", { id: "hidebtn", class: "btn small", type: "button"}, "✕");
    hide.addEventListener("click", toggleHud); 
    bar.appendChild(hide);

    const dots = document.getElementById("theme-dots"); 
    for ( let i = 0; i < THEMES.en.length; i++) { 
        const d = el("button", { class: "dot", type: "button", "data-theme": i}); 
        d.addEventListener("click", () => setTheme(i)); 
        dots.appendChild(d); 
    }
    const reveal = document.getElementById("reveal"); 
    reveal.addEventListener("click", toggleHud); 
    // after a mouse or touch click, drop focus so Space keeps toggling story mode (keyboard activation keeps focus)
    document.addEventListener("click", e => { 
        const b = e.target.closest && e.target.closest("button");
        if ( b && e.detail > 0) b.blur();
    });
}

function refreshInterface() { 
    const L = LABELS[lang]; 
    document.documentElement.lang = lang; 
    document.getElementById("brand-text").textContent = "FLEX · " + THEMES[lang][activeTheme]; 
    document.getElementById("status-text").textContent = uncertainTarget ? L.uncStatus : LEVELS[lang][targetLevel]; 
    document.getElementById("controls-text").textContent = L.keys; 
    document.getElementById("intro-line").textContent = L.intro; 
    document.querySelectorAll(".btn.level").forEach(b => { 
        const i = int(b.getAttribute("data-level"));
        b.textContent = L.level + " " + i; 
        b.classList.toggle("active", i === targetLevel); 
        b.setAttribute("aria-pressed", i === targetLevel); 
    }); 
    const sb = document.getElementById("storybtn"); 
    sb.textContent = storyOn ? L.stop: L.story; 
    sb.classList.toggle("active", storyOn); 
    const ub = document.getElementById("uncbtn"); 
    if (ub) { 
        ub.textContent = L.unc; 
        ub.classList.toggle("active", uncertainTarget === 1); 
    }
    document.getElementById("langbtn").textContent = L.lang; 
    document.getElementById("hidebtn").setAttribute("aria-label", L.hide); 
    document.querySelectorAll(".dot").forEach( d=> { 
        const i = int(d.getAttribute("data-theme")); 
        d.classList.toggle("active", i === activeTheme); 
        d.setAttribute("aria-label", L.theme + ": " + THEMES[lang][i]); 
        d.setAttribute("title", THEMES[lang][i]);
    });
}
