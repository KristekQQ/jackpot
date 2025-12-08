// --- SVG COLOR MATRIX SYSTEM (Nejspolehlivější metoda pro Tint) ---
const svgNs = "http://www.w3.org/2000/svg";
let svgContainer = null;

function getTintFilterUrl(r, g, b) {
    // Vytvoříme neviditelný kontejner pro filtry, pokud neexistuje
    if (!svgContainer) {
        svgContainer = document.createElementNS(svgNs, "svg");
        svgContainer.style.position = "absolute";
        svgContainer.style.width = "0";
        svgContainer.style.height = "0";
        svgContainer.style.pointerEvents = "none";
        // Vložíme ho na začátek body, aby nepřekážel
        document.body.insertBefore(svgContainer, document.body.firstChild);
    }

    const id = `tint-${r}-${g}-${b}`;
    if (document.getElementById(id)) return `url(#${id})`;

    // Přepočet 0-255 na 0.0-1.0 pro matici
    const rN = (r / 255).toFixed(3);
    const gN = (g / 255).toFixed(3);
    const bN = (b / 255).toFixed(3);

    // Vytvoříme ColorMatrix filtr
    // Tato matice vynásobí barvy textury naší barvou (Multiply efekt)
    // R' = R * rN
    // G' = G * gN
    // B' = B * bN
    // A' = A * 1
    const filter = document.createElementNS(svgNs, "filter");
    filter.id = id;
    filter.setAttribute("color-interpolation-filters", "sRGB"); // Důležité pro správné barvy

    const matrix = document.createElementNS(svgNs, "feColorMatrix");
    matrix.setAttribute("type", "matrix");
    matrix.setAttribute("values", `
        ${rN} 0 0 0 0
        0 ${gN} 0 0 0
        0 0 ${bN} 0 0
        0 0 0 1 0
    `);

    filter.appendChild(matrix);
    svgContainer.appendChild(filter);

    return `url(#${id})`;
}

// --- STANDARDNÍ FUNKCE (Loadery a Parsery) ---

async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
}

async function loadText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.text();
}

async function loadJsonWithBase(paths) {
    let lastErr;
    for (const p of paths) {
        try {
            const data = await loadJson(p);
            const base = p.slice(0, p.lastIndexOf("/") + 1);
            return { data, base };
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error("Failed to load JSON from provided paths");
}

function parseTuple(str) {
    return Array.from(str.matchAll(/-?\d+\.?\d*/g)).map((m) => parseFloat(m[0]));
}

function cleanPath(p) {
    if (!p) return "";
    return p.replace(/^\.?\/+/, "");
}

function parsePlistFrames(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const frames = new Map();
    const keys = Array.from(doc.querySelectorAll("plist > dict > key"));
    let textureFileName = "";
    let metaSize = "";

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const valNode = key.nextElementSibling;

        if (key.textContent === "frames" && valNode?.tagName === "dict") {
            let node = valNode.firstElementChild;
            while (node) {
                if (node.tagName === "key") {
                    const name = node.textContent;
                    const dict = node.nextElementSibling;
                    const entry = {};
                    let c = dict.firstElementChild;
                    while (c) {
                        if (c.tagName === "key") {
                            const k = c.textContent;
                            const vNode = c.nextElementSibling;
                            const vText = vNode?.textContent || "";
                            if (k === "frame") entry.frame = vText;
                            if (k === "sourceColorRect") entry.sourceColorRect = vText;
                            if (k === "sourceSize") entry.sourceSize = vText;
                            if (k === "rotated") entry.rotated = vNode.tagName === "true";
                        }
                        c = c.nextElementSibling;
                    }
                    frames.set(name, entry);
                }
                node = node.nextElementSibling;
            }
        }
        if (key.textContent === "metadata" && valNode?.tagName === "dict") {
            let c = valNode.firstElementChild;
            while (c) {
                if (c.tagName === "key" && c.textContent === "textureFileName") {
                    textureFileName = c.nextElementSibling?.textContent || "";
                }
                if (c.tagName === "key" && c.textContent === "size") {
                    metaSize = c.nextElementSibling?.textContent || "";
                }
                c = c.nextElementSibling;
            }
        }
    }
    return { frames, textureFileName, metaSize };
}

function parseSizeString(str) {
    const nums = parseTuple(str);
    return { w: nums[0] || 0, h: nums[1] || 0 };
}

function toAbs(basePath, rel) {
    const clean = cleanPath(rel || "");
    const baseUrl = new URL(basePath, window.location.href);
    return new URL(clean, baseUrl).toString();
}

function resolvePathRelative(p, basePath) {
    if (!p) return "";
    const clean = cleanPath(p);
    if (clean.startsWith("/")) return clean;
    return toAbs(basePath, clean);
}

const plistCache = new Map();
const spriteCache = new Map();
let BASE_PATH = "../res/exportJosn/";
let Y_AXIS_INVERTED = true;

async function loadAtlas(plistPath) {
    if (plistCache.has(plistPath)) return plistCache.get(plistPath);
    const plistText = await loadText(plistPath);
    const parsed = parsePlistFrames(plistText);
    const baseDir = plistPath.split("/").slice(0, -1).join("/");
    const texName = parsed.textureFileName || plistPath.replace(".plist", ".png").split("/").pop();
    const atlasPath = texName ? `${baseDir}/${texName}` : plistPath.replace(".plist", ".png");
    const atlasSize = parseSizeString(parsed.metaSize);
    const atlas = { frames: parsed.frames, atlasPath, atlasSize };
    plistCache.set(plistPath, atlas);
    return atlas;
}

async function resolveSprite(fileData, basePath = BASE_PATH) {
    const plistRel = cleanPath(fileData.Plist || "");
    const plistCandidates = [
        toAbs(basePath, plistRel),
        toAbs(basePath, `../${plistRel}`),
        toAbs(basePath, `../../${plistRel}`),
        plistRel,
    ];
    let atlas;
    let plistPath;
    let lastErr;
    for (const p of plistCandidates) {
        try {
            atlas = await loadAtlas(p);
            plistPath = p;
            break;
        } catch (e) {
            lastErr = e;
        }
    }
    if (!atlas) throw lastErr || new Error("Atlas not found");

    const frameName = fileData.Path;
    const key = `${plistPath}|${frameName}`;
    if (spriteCache.has(key)) return spriteCache.get(key);

    const meta = atlas.frames.get(frameName);
    if (!meta) throw new Error(`Frame ${frameName} not in ${plistPath}`);
    const [fx, fy, fw, fh] = parseTuple(meta.frame);
    const [cx, cy, cw, ch] = parseTuple(meta.sourceColorRect);
    const [sw, sh] = parseTuple(meta.sourceSize);
    const rotated = meta.rotated;

    const result = {
        atlasPath: atlas.atlasPath,
        atlasSize: { aw: atlas.atlasSize.w, ah: atlas.atlasSize.h },
        frame: { fx, fy, fw, fh },
        colorRect: { cx, cy, cw, ch },
        sourceSize: { sw, sh },
        rotated,
    };
    spriteCache.set(key, result);
    return result;
}

function assetPath(fileData, basePath = BASE_PATH) {
    if (!fileData) return null;
    if (fileData.Type === "Normal") {
        const base = cleanPath(fileData.Path || "");
        return resolvePathRelative(base, basePath);
    }
    return null;
}

function createElementForNode(node) {
    const el = document.createElement("div");
    el.classList.add("node");
    const size = node.Size || { X: 0, Y: 0 };
    el.style.width = `${size.X}px`;
    el.style.height = `${size.Y}px`;
    el.__size = { w: size.X || 0, h: size.Y || 0 };
    el.dataset.name = node.Name || "";
    if (node.ctype === "TextObjectData") {
        el.textContent = node.LabelText || "";
        el.classList.add("text-node");
        el.style.fontSize = `${node.FontSize || 24}px`;
        el.style.color = `rgb(${node.CColor?.R ?? 255},${node.CColor?.G ?? 255},${node.CColor?.B ?? 255})`;
        el.style.fontWeight = node.FontResource?.FontStyle || node.FontStyle || "300";
        if (node.FontResource?.Path) {
            const family = node.FontResource.Path.split("/").pop()?.replace(/\.[^.]+$/, "") || "Roboto";
            el.style.fontFamily = `"${family}", "Roboto", "Open Sans", "Arial", system-ui, sans-serif`;
        }
        el.style.textAlign = "center";
        el.style.whiteSpace = "nowrap";
    }
    return el;
}

function normalizeAnchor(anchor) {
    if (!anchor) return [0.5, 0.5];
    const ax = Object.prototype.hasOwnProperty.call(anchor, "ScaleX") ? anchor.ScaleX : 0;
    const ay = Object.prototype.hasOwnProperty.call(anchor, "ScaleY") ? anchor.ScaleY : 0;
    return [ax, ay];
}

// --- FUNKCE PRO TEXTURY ---
function updateElementTexture(el, atlas, isAtlas = true) {
    let innerEl = el.querySelector(".sprite-inner");
    if (!innerEl) {
        innerEl = document.createElement("div");
        innerEl.className = "sprite-inner";
        innerEl.style.position = "absolute";
        innerEl.style.transformOrigin = "50% 50%";
        el.appendChild(innerEl);
    }

    if (isAtlas) {
        let physicalW = atlas.frame.fw;
        let physicalH = atlas.frame.fh;
        if (atlas.rotated) {
            physicalW = atlas.frame.fh;
            physicalH = atlas.frame.fw;
        }

        const bgUrl = `url(${atlas.atlasPath})`;
        const bgSize = `${atlas.atlasSize.aw}px ${atlas.atlasSize.ah}px`;
        const bgPos = `-${atlas.frame.fx}px -${atlas.frame.fy}px`;

        innerEl.style.width = `${physicalW}px`;
        innerEl.style.height = `${physicalH}px`;
        innerEl.style.backgroundImage = bgUrl;
        innerEl.style.backgroundSize = bgSize;
        innerEl.style.backgroundPosition = bgPos;
        innerEl.style.backgroundRepeat = "no-repeat";

        const offsetX = atlas.colorRect.cx;
        const offsetY = atlas.colorRect.cy;

        if (atlas.rotated) {
            const targetW = physicalH;
            const targetH = physicalW;
            const diffW = targetW - physicalW;
            const diffH = targetH - physicalH;
            const finalLeft = offsetX + (diffW / 2);
            const finalTop = offsetY + (diffH / 2);

            innerEl.style.left = `${finalLeft}px`;
            innerEl.style.top = `${finalTop}px`;
            innerEl.style.transform = "rotate(-90deg)";
        } else {
            innerEl.style.left = `${offsetX}px`;
            innerEl.style.top = `${offsetY}px`;
            innerEl.style.transform = "none";
        }
    } else {
        const bgUrl = `url(${atlas})`;
        el.style.backgroundImage = bgUrl;
        el.style.backgroundSize = "100% 100%";
        el.style.backgroundRepeat = "no-repeat";

        const oldInner = el.querySelector(".sprite-inner");
        if (oldInner) oldInner.remove();
    }
}

// --- APLIKACE FILTRU BARVY ---
function applyTintFilter(el, color) {
    const { R, G, B } = color;
    const isDefault = (R >= 255 && G >= 255 && B >= 255);

    // Hledáme cílový element (pro atlasy je to .sprite-inner)
    const targetEl = el.querySelector(".sprite-inner") || el;

    // Pokud je to text-node, nebarvíme filtrem, ale barvou písma (pokud by bylo třeba)
    // Tady předpokládáme, že chceme barvit jen obrázky.
    if (el.classList.contains("text-node")) return;

    // Pokud element nemá obrázek (je to jen kontejner), filtr nedáváme,
    // aby neobarvil nechtěně vnořené věci divným způsobem.
    const bgImage = targetEl.style.backgroundImage;
    if (!bgImage || bgImage === "none") {
        targetEl.style.filter = "";
        return;
    }

    if (isDefault) {
        targetEl.style.filter = "";
    } else {
        const filterUrl = getTintFilterUrl(R, G, B);
        targetEl.style.filter = filterUrl;
    }
}

// --- APPLY TRANSFORM ---
function applyTransform(el, state) {
    const [ax, ay] = normalizeAnchor(state.AnchorPoint);
    const x = state.Position?.X || 0;
    const y = state.Position?.Y || 0;
    const sx = state.Scale?.X ?? 1;
    const sy = state.Scale?.Y ?? 1;
    const rotX = state.RotationSkewX ?? 0;
    const rotY = state.RotationSkewY ?? rotX;
    const rot = (rotX + rotY) / 2;
    const size = el.__size || { w: 0, h: 0 };

    const left = x - ax * size.w;
    el.style.left = `${left}px`;

    if (Y_AXIS_INVERTED) {
        const bottom = y - (ay * size.h);
        el.style.bottom = `${bottom}px`;
        el.style.top = 'auto';
    } else {
        const top = y - ay * size.h;
        el.style.top = `${top}px`;
        el.style.bottom = 'auto';
    }

    const originY = Y_AXIS_INVERTED ? (1 - ay) : ay;
    el.style.transformOrigin = `${ax * 100}% ${originY * 100}%`;
    el.style.transform = `scale(${sx}, ${sy}) rotate(${rot}deg)`;

    if (typeof state.Alpha === "number") el.style.opacity = state.Alpha / 255;
    if (typeof state.VisibleForFrame === "boolean") el.style.visibility = state.VisibleForFrame ? "visible" : "hidden";

    if (state.BlendFunc) {
        const { Src, Dst } = state.BlendFunc;
        const additive = Src === 770 && (Dst === 1 || Dst === 771);
        el.classList.toggle("blend-add", additive);
    }

    // --- LOGIKA OBARVENÍ ---
    const color = state.CColor || { R: 255, G: 255, B: 255 };

    // 1. Změna Textury
    if (state.FileData && state.FileData !== el.__lastFileData) {
        el.__lastFileData = state.FileData;
        const baseForAssets = el.__basePath || BASE_PATH;

        if (state.FileData.Type === "PlistSubImage" && state.FileData.Plist) {
            resolveSprite(state.FileData, baseForAssets).then(atlas => {
                updateElementTexture(el, atlas, true);
                applyTintFilter(el, color);
            }).catch(e => console.error("Sprite resolve failed", e));
        } else {
            const src = assetPath(state.FileData, baseForAssets);
            if (src) {
                updateElementTexture(el, src, false);
                applyTintFilter(el, color);
            }
        }
    } else {
        // 2. Pouze změna barvy (textura stejná)
        const prevColor = el.__lastAppliedColor;
        const colorChanged = !prevColor || prevColor.R !== color.R || prevColor.G !== color.G || prevColor.B !== color.B;

        if (colorChanged) {
            applyTintFilter(el, color);
            el.__lastAppliedColor = { ...color };
        }
    }
}

function buildTimelineMap(animation) {
    const map = new Map();
    for (const timeline of animation.Timelines || []) {
        const tag = timeline.ActionTag;
        if (!map.has(tag)) map.set(tag, new Map());
        const propMap = map.get(tag);
        propMap.set(timeline.Property, timeline.Frames || timeline.Frame || []);
    }
    return map;
}

function applyFrameForMap(actionMap, timelines, frame) {
    for (const [tag, elements] of actionMap.entries()) {
        const propMap = timelines.get(tag) || new Map();
        for (const el of elements) {
            const state = { ...el.__baseState };
            for (const [prop, frames] of propMap.entries()) {
                const val = sampleFrame(frames, frame);
                updateProperty(state, prop, val);
            }
            const innerAction = el.__manualInnerAction || state.InnerAction;
            if (innerAction && el.__subPlayer) {
                const target = innerAction.CurrentAniamtionName || el.__subPlayer.defaultName;
                const innerType = innerAction.InnerActionType || "NoLoopAction";
                const key = `${target}|${innerType}|${innerAction.SingleFrameIndex ?? ""}`;
                if (target && el.__innerActionKey !== key) {
                    el.__innerActionKey = key;
                    el.__innerActionName = target;
                    el.__subPlayer.play(target, innerType, innerAction.SingleFrameIndex);
                }
            }
            applyTransform(el, state);
        }
    }
}

async function createPlayerFromContent(content, mountEl, basePath, namesMap) {
    const animation = content.Animation;
    const objectData = content.ObjectData;
    if (!animation || !objectData) return null;

    const timelines = buildTimelineMap(animation);
    const animationList = new Map();
    const list = content.AnimationList || animation.AnimationList || [];
    for (const info of list) {
        animationList.set(info.Name, { start: info.StartIndex, end: info.EndIndex });
    }
    const actionMap = new Map();
    await buildNodes(objectData, mountEl, actionMap, basePath, namesMap);

    const defaultName = animation.ActivedAnimationName || list[0]?.Name;
    const fps = 60;
    let raf = null;
    let resolveCurrent = null;

    const applyFrame = (frame) => applyFrameForMap(actionMap, timelines, frame);
    applyFrame(0);

    function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (resolveCurrent) {
            resolveCurrent();
            resolveCurrent = null;
        }
    }

    function play(name, innerActionType, startFrameIndex) {
        const target = name || defaultName;
        const info = target ? animationList.get(target) : null;
        if (!info) return Promise.resolve(null);
        stop();
        const loop = innerActionType === "LoopAction";
        const offset = typeof startFrameIndex === "number" ? startFrameIndex : 0;

        applyFrame(info.start + offset);

        return new Promise((resolve) => {
            resolveCurrent = resolve;
            const length = Math.max(info.end - info.start, 1);
            const durationMs = (length / fps) * 1000;
            const start = performance.now();

            const tick = (now) => {
                const t = (now - start) / durationMs;
                const progress = loop ? (t % 1) : Math.min(t, 1);
                const frame = info.start + offset + progress * (info.end - info.start);

                applyFrame(frame);
                if (loop || t < 1) {
                    raf = requestAnimationFrame(tick);
                } else {
                    raf = null;
                    resolveCurrent = null;
                    resolve();
                }
            };
            raf = requestAnimationFrame(tick);
        });
    }

    return { play, animations: animationList, defaultName };
}

function sampleFrame(frames, frameIndex) {
    if (!frames || frames.length === 0) return undefined;
    if (frameIndex <= frames[0].FrameIndex) return frames[0];
    if (frameIndex >= frames[frames.length - 1].FrameIndex) return frames[frames.length - 1];
    const ease = (t, easing) => {
        if (!easing) return t;
        switch (easing.Type) {
            case 0: return t;
            case 1: return t * t;
            case 2: return 1 - (1 - t) * (1 - t);
            case 3: return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            default: return t;
        }
    };
    for (let i = 0; i < frames.length - 1; i++) {
        const a = frames[i];
        const b = frames[i + 1];
        if (frameIndex >= a.FrameIndex && frameIndex <= b.FrameIndex) {
            const t = (frameIndex - a.FrameIndex) / (b.FrameIndex - a.FrameIndex || 1);
            const eased = ease(t, b.EasingData || a.EasingData);
            if (a.ctype === "PointFrameData") return { X: a.X + (b.X - a.X) * eased, Y: a.Y + (b.Y - a.Y) * eased };
            if (a.ctype === "ScaleValueFrameData") return { X: a.X + (b.X - a.X) * eased, Y: a.Y + (b.Y - a.Y) * eased };
            if (a.ctype === "IntFrameData") return { Value: a.Value + (b.Value - a.Value) * eased };
            if (a.ctype === "BoolFrameData") return { Value: eased < 1 ? a.Value : b.Value };
            if (a.ctype === "TextureFrameData") return t < 1 ? a : b;
            return a;
        }
    }
    return frames[frames.length - 1];
}

function extractInitialState(node) {
    return {
        Position: node.Position || { X: 0, Y: 0 },
        Scale: node.Scale || { X: 1, Y: 1 },
        RotationSkewX: node.RotationSkewX || 0,
        RotationSkewY: node.RotationSkewY || 0,
        AnchorPoint: node.AnchorPoint || { ScaleX: 0.5, ScaleY: 0.5 },
        Alpha: typeof node.Alpha === "number" ? node.Alpha : 255,
        VisibleForFrame: node.VisibleForFrame !== false,
        FileData: node.FileData,
        BlendFunc: node.BlendFunc,
        InnerAction: null,
        CColor: node.CColor || { R: 255, G: 255, B: 255 },
    };
}

function updateProperty(state, property, sample) {
    if (!sample) return;
    if (property === "Position") state.Position = sample;
    if (property === "Scale") state.Scale = sample;
    if (property === "RotationSkew") { state.RotationSkewX = sample.X; state.RotationSkewY = sample.Y ?? sample.X; }
    if (property === "Alpha") state.Alpha = sample.Value;
    if (property === "VisibleForFrame") state.VisibleForFrame = sample.Value;
    if (property === "FileData" && sample.TextureFile) state.FileData = sample.TextureFile;
    if (property === "BlendFunc") state.BlendFunc = sample;
    if (property === "ActionValue") state.InnerAction = sample;
    if (property === "CColor") state.CColor = sample.Color || sample;
}

async function buildNodes(node, parentEl, actionMap, basePath, namesMap, zIndex = 0) {
    const el = createElementForNode(node);
    const state = extractInitialState(node);
    el.__baseState = state;
    el.__basePath = basePath;
    el.classList.add("sprite");
    el.style.zIndex = String(zIndex);


    parentEl.appendChild(el);
    el.dataset.name = node.Name || "";
    if (node.Name) {
        if (!namesMap.has(node.Name)) namesMap.set(node.Name, []);
        namesMap.get(node.Name).push(el);
    }
    const tag = node.ActionTag;
    if (!actionMap.has(tag)) actionMap.set(tag, []);
    actionMap.get(tag).push(el);

    if (node.ctype === "ProjectNodeObjectData" && node.FileData?.Path) {
        const nestedPath = resolvePathRelative(node.FileData.Path, basePath);
        const nestedBase = nestedPath.slice(0, nestedPath.lastIndexOf("/") + 1);
        try {
            const nested = await loadJson(nestedPath);
            const nestedContent = nested.Content?.Content;
            if (nestedContent?.ObjectData && nestedContent?.Animation) {
                if (node.Name) nestedContent.ObjectData.Name = node.Name;
                nestedContent.ObjectData.ActionTag = node.ActionTag ?? nestedContent.ObjectData.ActionTag;
                nestedContent.ObjectData.Position = nestedContent.ObjectData.Position || { X: 0, Y: 0 };
                nestedContent.ObjectData.Scale = nestedContent.ObjectData.Scale || { X: 1, Y: 1 };
                nestedContent.ObjectData.AnchorPoint = nestedContent.ObjectData.AnchorPoint || { ScaleX: 0.5, ScaleY: 0.5 };
                const subPlayer = await createPlayerFromContent(nestedContent, el, nestedBase, namesMap);
                if (subPlayer) {
                    el.__subPlayer = subPlayer;
                    el.__innerActionName = subPlayer.defaultName;
                    if (subPlayer.defaultName) {
                        subPlayer.play(subPlayer.defaultName, "LoopAction");
                    }
                }
            }
        } catch (e) {
            console.error("Nested project load failed", node.FileData.Path, e);
        }
    }

    const file = node.FileData;
    if (file && file.Type === "PlistSubImage") {
        try {
            const atlas = await resolveSprite(file, basePath);
            const fullW = atlas.sourceSize.sw;
            const fullH = atlas.sourceSize.sh;
            el.style.width = `${fullW}px`;
            el.style.height = `${fullH}px`;
            el.__size = { w: fullW, h: fullH };
            el.style.backgroundImage = 'none';
            el.style.overflow = 'visible';

            updateElementTexture(el, atlas, true);
            el.__baseState.FileData = file;
        } catch (e) {
            console.error("Sprite resolve failed", file, e);
        }
    } else {
        const src = assetPath(file, basePath);
        if (src) {
            updateElementTexture(el, src, false);
        }
    }

    if (node.Children) {
        for (let idx = 0; idx < node.Children.length; idx++) {
            const child = node.Children[idx];
            await buildNodes(child, el, actionMap, basePath, namesMap, zIndex + idx + 1);
        }
    }
}

async function main(jsonPath = "../res/exportJosn/jackpot.json") {
    const root = document.querySelector("#scene-origin");
    const stage = document.querySelector("#stage");
    if (!root || !stage) return;

    const { data, base } = await loadJsonWithBase([jsonPath]);
    const coordType = data?.Content?.Content?.CoordinateType;
    Y_AXIS_INVERTED = coordType === "yDown" ? false : true;
    BASE_PATH = base;
    const content = data.Content.Content;
    const animation = content.Animation;
    const objectData = content.ObjectData;
    const timelines = buildTimelineMap(animation);

    const animationList = new Map();
    const list = content.AnimationList || animation.AnimationList || [];
    for (const info of list) {
        animationList.set(info.Name, { start: info.StartIndex, end: info.EndIndex });
    }

    const actionMap = new Map();
    const namesMap = new Map();
    await buildNodes(objectData, root, actionMap, base, namesMap);

    const fps = 60;
    const resize = () => {
        const rect = stage.getBoundingClientRect();
        const scaleX = rect.width / 1280;
        const scaleY = rect.height / 720;
        const scale = Math.min(scaleX, scaleY);
        root.style.setProperty("--scene-scale", scale.toString());
    };
    resize();
    window.addEventListener("resize", resize);

    const applyFrame = (frame) => applyFrameForMap(actionMap, timelines, frame);
    applyFrame(0);

    let current = null;
    let resolveCurrent = null;
    function play(name) {
        const info = animationList.get(name);
        if (!info) return Promise.reject(new Error(`Unknown animation ${name}`));
        if (resolveCurrent) resolveCurrent();
        const length = Math.max(info.end - info.start, 1);
        const durationMs = (length / fps) * 1000;
        current = {
            name,
            start: info.start,
            end: info.end,
            durationMs,
            startedAt: performance.now(),
        };
        return new Promise((resolve) => {
            resolveCurrent = resolve;
        });
    }

    function tick(now) {
        if (current) {
            const elapsed = now - current.startedAt;
            const t = Math.min(elapsed / current.durationMs, 1);
            const frame = current.start + (current.end - current.start) * t;
            applyFrame(frame);
            if (t >= 1 && resolveCurrent) {
                resolveCurrent();
                resolveCurrent = null;
                current = null;
            }
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    const player = {
        play,
        animations: animationList,
        getElement(name) {
            const arr = namesMap.get(name);
            return arr ? arr[0] : null;
        },
        getElements(name) {
            return namesMap.get(name) || [];
        },
        getSubPlayer(name) {
            const arr = namesMap.get(name) || [];
            for (const el of arr) {
                if (el.__subPlayer) return el.__subPlayer;
            }
            return null;
        },
        playNested(name, animationName, innerType = "LoopAction", startFrameIndex) {
            const sub = this.getSubPlayer(name);
            if (!sub) return Promise.reject(new Error(`Subplayer ${name} not found`));

            const arr = namesMap.get(name) || [];
            for (const el of arr) {
                if (el.__subPlayer) {
                    el.__manualInnerAction = {
                        CurrentAniamtionName: animationName,
                        InnerActionType: innerType,
                        SingleFrameIndex: startFrameIndex,
                    };
                    el.__innerActionKey = `${animationName}|${innerType}|${startFrameIndex ?? ""}`;
                }
            }
            const promise = sub.play(animationName, innerType, startFrameIndex);
            return promise;
        },
        clearNested(name) {
            const arr = namesMap.get(name) || [];
            for (const el of arr) {
                if (el.__subPlayer) {
                    delete el.__manualInnerAction;
                    el.__innerActionKey = null;
                }
            }
        },
        setText(name, text) {
            const arr = namesMap.get(name);
            if (!arr) return false;
            let changed = false;
            for (const el of arr) {
                el.textContent = text;
                const inner = el.querySelector(".text-node");
                if (inner) inner.textContent = text;
                changed = true;
            }
            return changed;
        },
        setLabel(name, opts = {}) {
            const arr = namesMap.get(name);
            if (!arr) return false;
            let changed = false;
            for (const host of arr) {
                const el = host.querySelector(".text-node") || host;
                if (opts.text !== undefined) {
                    el.textContent = opts.text;
                    host.textContent = opts.text;
                    changed = true;
                }
                if (opts.color !== undefined) {
                    const color = typeof opts.color === "string"
                        ? opts.color
                        : `rgb(${opts.color.R ?? 255},${opts.color.G ?? 255},${opts.color.B ?? 255})`;
                    el.style.color = color;
                    changed = true;
                }
                if (opts.fontSize !== undefined) {
                    el.style.fontSize = typeof opts.fontSize === "number" ? `${opts.fontSize}px` : opts.fontSize;
                    changed = true;
                }
            }
            return changed;
        },
        // --- OPRAVA SETCOLOR: Vylepšené procházení (rekurze) ---
        setColor(name, color) {
            const arr = namesMap.get(name);
            if (!arr) return false;
            const rgb = (() => {
                if (typeof color === "string") {
                    const hex = color.replace("#", "");
                    const r = parseInt(hex.slice(0, 2), 16);
                    const g = parseInt(hex.slice(2, 4), 16);
                    const b = parseInt(hex.slice(4, 6), 16);
                    return { R: r, G: g, B: b };
                }
                return { R: color.R ?? 255, G: color.G ?? 255, B: color.B ?? 255 };
            })();
            let changed = false;
            for (const host of arr) {
                // Aplikujeme barvu na kontejner
                if (host.__baseState) {
                    host.__baseState.CColor = rgb;
                    applyTransform(host, { ...host.__baseState, CColor: rgb });
                    changed = true;
                }
                // HACK: Najdeme všechny spritové děti uvnitř (pro display_bg)
                // Ignorujeme text-node, aby se neobarvil text
                const sprites = host.querySelectorAll(".sprite");
                sprites.forEach((s) => {
                    if (s.__baseState && !s.classList.contains("text-node")) {
                        s.__baseState.CColor = rgb;
                        applyTransform(s, { ...s.__baseState, CColor: rgb });
                        changed = true;
                    }
                });
            }
            return changed;
        },
        ready: Promise.resolve(),
    };
    window.jackpotPlayer = player;
    return player;
}

document.addEventListener("DOMContentLoaded", () => {
});