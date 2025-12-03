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

        // Načtení framů
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

                            // --- OPRAVA ZDE ---
                            // Kontrolujeme tagName, protože v plistu je <true/> nebo <false/>
                            if (k === "rotated") {
                                entry.rotated = vNode.tagName === "true";
                            }
                            // ------------------
                        }
                        c = c.nextElementSibling;
                    }
                    frames.set(name, entry);
                }
                node = node.nextElementSibling;
            }
        }

        // Metadata
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
let Y_AXIS_INVERTED = true; // true = Cocos styl Y nahoru (výchozí pro naše exporty), false = Y dolů

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
    el.style.color = `rgb(${node.CColor?.R || 255},${node.CColor?.G || 255},${node.CColor?.B || 255})`;
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

    // 1. POZICE (Position)
    // Výpočet Left zůstává stejný
    const left = x - ax * size.w;
    el.style.left = `${left}px`;

    // --- OPRAVA POZICOVÁNÍ Y ---
    if (Y_AXIS_INVERTED) {
        // Cocos režim (Y roste nahoru):
        // Použijeme 'bottom' místo 'top'.
        // y = vzdálenost bodu ukotvení od spodku rodiče.
        // Musíme odečíst (ay * size.h), abychom posunuli "fyzický" spodek divu na správné místo.

        const bottom = y - (ay * size.h);

        el.style.bottom = `${bottom}px`;
        el.style.top = 'auto'; // Důležité: zrušit top, aby se nehádal s bottom
    } else {
        // Standardní režim (Y roste dolů):
        const top = y - ay * size.h;
        el.style.top = `${top}px`;
        el.style.bottom = 'auto';
    }

    // 2. TRANSFORM ORIGIN
    // Pokud používáme Y-Up (Cocos), musíme invertovat Y složku anchoru pro CSS transform-origin
    // (protože v CSS je 0% nahoře, zatímco v Cocos ay=1 je nahoře).
    const originY = Y_AXIS_INVERTED ? (1 - ay) : ay;
    el.style.transformOrigin = `${ax * 100}% ${originY * 100}%`;

    // 3. TRANSFORMACE
    el.style.transform = `scale(${sx}, ${sy}) rotate(${rot}deg)`;

    // 4. OSTATNÍ VLASTNOSTI
    if (typeof state.Alpha === "number") {
        el.style.opacity = state.Alpha / 255;
    }
    if (typeof state.VisibleForFrame === "boolean") {
        el.style.visibility = state.VisibleForFrame ? "visible" : "hidden";
    }
    if (state.BlendFunc) {
        const { Src, Dst } = state.BlendFunc;
        const additive = Src === 770 && (Dst === 1 || Dst === 771);
        el.classList.toggle("blend-add", additive);
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
      if (state.InnerAction && el.__subPlayer) {
        const target = state.InnerAction.CurrentAniamtionName || el.__subPlayer.defaultName;
        if (target && el.__innerActionName !== target) {
          el.__innerActionName = target;
          el.__subPlayer.play(target, state.InnerAction.InnerActionType);
        }
      }
      applyTransform(el, state);
    }
  }
}

async function createPlayerFromContent(content, mountEl, basePath) {
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
  await buildNodes(objectData, mountEl, actionMap, basePath);

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

  function play(name, innerActionType) {
    const target = name || defaultName;
    const info = target ? animationList.get(target) : null;
    if (!info) return Promise.resolve(null);
    stop();
    const loop = innerActionType === "LoopAction";
    return new Promise((resolve) => {
      resolveCurrent = resolve;
      const length = Math.max(info.end - info.start, 1);
      const durationMs = (length / fps) * 1000;
      const start = performance.now();
      const tick = (now) => {
        const t = (now - start) / durationMs;
        const frame = info.start + Math.min(t, 1) * length;
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
      case 0:
        return t;
      case 1:
        return t * t;
      case 2:
        return 1 - (1 - t) * (1 - t);
      case 3:
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t;
    }
  };
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (frameIndex >= a.FrameIndex && frameIndex <= b.FrameIndex) {
      const t = (frameIndex - a.FrameIndex) / (b.FrameIndex - a.FrameIndex || 1);
      const eased = ease(t, b.EasingData || a.EasingData);
      if (a.ctype === "PointFrameData") {
        return { X: a.X + (b.X - a.X) * eased, Y: a.Y + (b.Y - a.Y) * eased };
      }
      if (a.ctype === "ScaleValueFrameData") {
        return { X: a.X + (b.X - a.X) * eased, Y: a.Y + (b.Y - a.Y) * eased };
      }
      if (a.ctype === "IntFrameData") {
        return { Value: a.Value + (b.Value - a.Value) * eased };
      }
      if (a.ctype === "BoolFrameData") {
        return { Value: eased < 1 ? a.Value : b.Value };
      }
      if (a.ctype === "TextureFrameData") {
        return t < 1 ? a : b;
      }
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
  };
}

function updateProperty(state, property, sample) {
  if (!sample) return;
  if (property === "Position") state.Position = sample;
  if (property === "Scale") state.Scale = sample;
  if (property === "RotationSkew") {
    state.RotationSkewX = sample.X;
    state.RotationSkewY = sample.Y ?? sample.X;
  }
  if (property === "Alpha") state.Alpha = sample.Value;
  if (property === "VisibleForFrame") state.VisibleForFrame = sample.Value;
  if (property === "FileData" && sample.TextureFile) state.FileData = sample.TextureFile;
  if (property === "BlendFunc") state.BlendFunc = sample;
  if (property === "ActionValue") state.InnerAction = sample;
}

async function buildNodes(node, parentEl, actionMap, basePath, zIndex = 0) {
    const el = createElementForNode(node);
    const state = extractInitialState(node);
    el.__baseState = state;
    el.classList.add("sprite");
    el.style.zIndex = String(zIndex);
    parentEl.appendChild(el);
    el.dataset.name = node.Name || "";
    const tag = node.ActionTag;
    if (!actionMap.has(tag)) actionMap.set(tag, []);
    actionMap.get(tag).push(el);

    // Pokud je to ProjectNodeObjectData, načteme vnořený projekt jako sub-player
    if (node.ctype === "ProjectNodeObjectData" && node.FileData?.Path) {
        const nestedPath = resolvePathRelative(node.FileData.Path, basePath);
        const nestedBase = nestedPath.slice(0, nestedPath.lastIndexOf("/") + 1);
        try {
            const nested = await loadJson(nestedPath);
            const nestedContent = nested.Content?.Content;
            if (nestedContent?.ObjectData && nestedContent?.Animation) {
                // přenést název/ActionTag na kořen vnořeného projektu, aby seděl s časovou osou rodiče
                if (node.Name) nestedContent.ObjectData.Name = node.Name;
                nestedContent.ObjectData.ActionTag = node.ActionTag ?? nestedContent.ObjectData.ActionTag;
                nestedContent.ObjectData.Position = nestedContent.ObjectData.Position || { X: 0, Y: 0 };
                nestedContent.ObjectData.Scale = nestedContent.ObjectData.Scale || { X: 1, Y: 1 };
                nestedContent.ObjectData.AnchorPoint = nestedContent.ObjectData.AnchorPoint || { ScaleX: 0.5, ScaleY: 0.5 };
                const subPlayer = await createPlayerFromContent(nestedContent, el, nestedBase);
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

    // --- ZDE ZAČÍNÁ FIX PRO ATLASY ---
    const file = node.FileData;
    if (file && file.Type === "PlistSubImage") {
        try {
            const atlas = await resolveSprite(file, basePath);

            // 1. Nastavíme HLAVNÍMU elementu plnou (neoříznutou) velikost
            const fullW = atlas.sourceSize.sw;
            const fullH = atlas.sourceSize.sh;

            el.style.width = `${fullW}px`;
            el.style.height = `${fullH}px`;
            el.__size = { w: fullW, h: fullH };

            // Reset stylů
            el.style.backgroundImage = 'none';
            el.style.overflow = 'visible';

            // 2. Připravíme data pro VNITŘNÍ element
            let innerEl = el.querySelector(".sprite-inner");
            if (!innerEl) {
                innerEl = document.createElement("div");
                innerEl.className = "sprite-inner";
                innerEl.style.position = "absolute";
                innerEl.style.transformOrigin = "50% 50%";
                el.appendChild(innerEl);
            }

            // --- OPRAVA ROZMĚRŮ PRO ROTACI ---
            // Zjistíme fyzické rozměry výřezu v atlasu.
            // Pokud je rotated: true, v plistu jsou rozměry prohozené (logické).
            // My potřebujeme fyzické (jak leží v png).
            let physicalW = atlas.frame.fw;
            let physicalH = atlas.frame.fh;

            if (atlas.rotated) {
                physicalW = atlas.frame.fh; // Prohodíme
                physicalH = atlas.frame.fw; // Prohodíme
            }

            // Nastavíme velikost vnitřního divu přesně podle fyzického výřezu
            // Tím zmizí "čanourek" (bleeding), protože div nebude širší než textura.
            innerEl.style.width = `${physicalW}px`;
            innerEl.style.height = `${physicalH}px`;

            // Nastavíme pozadí
            innerEl.style.backgroundImage = `url(${atlas.atlasPath})`;
            innerEl.style.backgroundRepeat = "no-repeat";
            innerEl.style.backgroundSize = `${atlas.atlasSize.aw}px ${atlas.atlasSize.ah}px`;
            innerEl.style.backgroundPosition = `-${atlas.frame.fx}px -${atlas.frame.fy}px`;

            // 3. Výpočet pozice a rotace (OFFSET)
            const offsetX = atlas.colorRect.cx;
            const offsetY = atlas.colorRect.cy;

            if (atlas.rotated) {
                // --- ROTATED (-90 stupňů) ---

                // Cílová vizuální šířka a výška po otočení jsou prohozené fyzické rozměry
                const targetW = physicalH;
                const targetH = physicalW;

                // Vycentrování rotace:
                // Máme obdélník physicalW x physicalH.
                // Chceme, aby po otočení vizuálně zabíral targetW x targetH na pozici offsetX, offsetY.
                // Protože se točí kolem středu, musíme posunout střed o polovinu rozdílu rozměrů.

                const diffW = targetW - physicalW;
                const diffH = targetH - physicalH;

                const left = offsetX + (diffW / 2);
                const top = offsetY + (diffH / 2);

                innerEl.style.left = `${left}px`;
                innerEl.style.top = `${top}px`;
                innerEl.style.transform = "rotate(-90deg)";

            } else {
                // --- STANDARDNÍ ---
                innerEl.style.left = `${offsetX}px`;
                innerEl.style.top = `${offsetY}px`;
                innerEl.style.transform = "none";
            }

            el.__baseState.FileData = file;
        } catch (e) {
            console.error("Sprite resolve failed", file, e);
        }
    } else {
        // --- STANDARDNÍ OBRÁZEK ---
        const src = assetPath(file, basePath);
        if (src) {
            el.style.backgroundImage = `url(${src})`;
            el.style.backgroundSize = "100% 100%";
            el.style.backgroundRepeat = "no-repeat";
        }
    }
    // --- ZBYTEK FUNKCE (REKURZE PRO DĚTI) ---
    if (node.Children) {
        for (let idx = 0; idx < node.Children.length; idx++) {
            const child = node.Children[idx];
            await buildNodes(child, el, actionMap, basePath, zIndex + idx + 1);
        }
    }
}

async function main(jsonPath = "../res/exportJosn/jackpot.json") {
  const root = document.querySelector("#scene-origin");
  const stage = document.querySelector("#stage");
  if (!root || !stage) return;

  const { data, base } = await loadJsonWithBase([jsonPath]);
  const coordType = data?.Content?.Content?.CoordinateType;
  // Výchozí je osa Y nahoru (invertovaná pro CSS). Přepneme jen při explicitní informaci v JSONu.
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
  await buildNodes(objectData, root, actionMap, base);

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
    ready: Promise.resolve(),
  };
  window.jackpotPlayer = player;
  return player;
}

document.addEventListener("DOMContentLoaded", () => {
  // main is invoked from app.js
});
