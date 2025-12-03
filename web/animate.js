async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

async function loadJsonFallback(paths) {
  let lastErr;
  for (const p of paths) {
    try {
      return await loadJson(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Failed to load JSON from provided paths");
}

function baseName(path) {
  if (!path) return path;
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1];
}

function assetPath(fileData) {
  if (!fileData) return null;
  if (fileData.Type === "PlistSubImage") {
    return `assets/${fileData.Path}`;
  }
  if (fileData.Type === "Normal") {
    return `assets/${baseName(fileData.Path)}`;
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

  const blend = node.BlendFunc || {};
  if (blend.Src === 770 && blend.Dst === 1) {
    el.style.mixBlendMode = "screen"; // additive
    el.classList.add("blend-add");
  }

  if (node.ctype === "SpriteObjectData" || node.ctype === "SingleNodeObjectData") {
    const src = assetPath(node.FileData);
    if (src) {
      el.style.backgroundImage = `url(${src})`;
      el.style.backgroundSize = "100% 100%";
      el.style.backgroundRepeat = "no-repeat";
    }
  } else if (node.ctype === "TextObjectData") {
    el.textContent = node.LabelText || "";
    el.classList.add("text-node");
    el.style.fontSize = `${node.FontSize || 24}px`;
    el.style.color = `rgb(${node.CColor?.R || 255},${node.CColor?.G || 255},${node.CColor?.B || 255})`;
    el.style.textAlign = "center";
    el.style.whiteSpace = "nowrap";
  }

  el.dataset.actionTag = node.ActionTag;
  el.dataset.name = node.Name || "";
  el.dataset.ctype = node.ctype;
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
    const rot = state.RotationSkewX ?? 0;
    const size = el.__size || { w: 0, h: 0 };

    // 1. POZICE (Position)
    // Cocos má Y nahoru, CSS dolů. Proto top = -y.
    // Musíme také zohlednit Anchor Point pro umístění levého horního rohu divu.
    // V Cocos ay=0 je spodek. V CSS top=0 je vršek.
    // Výpočet: -y (otočení osy) - (vzdálenost od anchoru k horní hraně v CSS)
    const left = x - ax * size.w;
    const top = -y - (1 - ay) * size.h;

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    // 2. TRANSFORM ORIGIN (Klíčová oprava)
    // Cocos Anchor Y: 0 = Spodek, 1 = Vršek
    // CSS Origin Y: 0% = Vršek, 100% = Spodek
    // Proto musíme Y invertovat: (1 - ay)
    el.style.transformOrigin = `${ax * 100}% ${(1 - ay) * 100}%`;

    // 3. TRANSFORMACE
    el.style.transform = `scale(${sx}, ${sy}) rotate(${rot}deg)`;

    if (typeof state.Alpha === "number") {
        el.style.opacity = state.Alpha / 255;
    }
    if (typeof state.VisibleForFrame === "boolean") {
        el.style.visibility = state.VisibleForFrame ? "visible" : "hidden";
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

function sampleFrame(frames, frameIndex) {
  if (!frames || frames.length === 0) return undefined;
  if (frameIndex <= frames[0].FrameIndex) return frames[0];
  if (frameIndex >= frames[frames.length - 1].FrameIndex) return frames[frames.length - 1];
  const ease = (t, easing) => {
    if (!easing) return t;
    switch (easing.Type) {
      case 0:
        return t;
      case 1: // ease-in (quad)
        return t * t;
      case 2: // ease-out (quad)
        return 1 - (1 - t) * (1 - t);
      case 3: // ease-in-out (quad)
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case -1: {
        // custom bezier with 4 control points
        const pts = easing.Points || [];
        if (pts.length === 4) {
          const [p0, p1, p2, p3] = pts;
          const cx = 3 * p0.X;
          const bx = 3 * (p2.X - p0.X) - cx;
          const ax = 1 - cx - bx;
          const cy = 3 * p0.Y;
          const by = 3 * (p2.Y - p0.Y) - cy;
          const ay = 1 - cy - by;
          const x = ((ax * t + bx) * t + cx) * t;
          const y = ((ay * t + by) * t + cy) * t;
          return x !== 0 ? y : t;
        }
        if (pts.length === 2) {
          const [p0, p1] = pts;
          const cx = 3 * p0.X;
          const bx = 3 * p1.X - cx;
          const ax = 1 - cx - bx;
          const cy = 3 * p0.Y;
          const by = 3 * p1.Y - cy;
          const ay = 1 - cy - by;
          const x = ((ax * t + bx) * t + cx) * t;
          const y = ((ay * t + by) * t + cy) * t;
          return x !== 0 ? y : t;
        }
        return t;
      }
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
  };
}

function updateProperty(state, property, sample) {
  if (!sample) return;
  if (property === "Position") state.Position = sample;
  if (property === "Scale") state.Scale = sample;
  if (property === "RotationSkew") state.RotationSkewX = sample.X;
  if (property === "Alpha") state.Alpha = sample.Value;
  if (property === "VisibleForFrame") state.VisibleForFrame = sample.Value;
  if (property === "FileData" && sample.TextureFile) state.FileData = sample.TextureFile;
  if (property === "BlendFunc") state.BlendFunc = sample;
}

async function buildNodes(node, parentEl, actionMap, assetsBase = "assets", zIndex = 0) {
  const el = createElementForNode(node);
  const state = extractInitialState(node);
  el.__baseState = state;
  el.classList.add("sprite");
  el.style.zIndex = String(zIndex);
  parentEl.appendChild(el);
  const tag = node.ActionTag;
  if (!actionMap.has(tag)) actionMap.set(tag, []);
  actionMap.get(tag).push(el);

  if (node.Children) {
    for (let idx = 0; idx < node.Children.length; idx++) {
      const child = node.Children[idx];
      if (child.ctype === "ProjectNodeObjectData" && child.FileData?.Path) {
        const nested = await loadJson(`../res/exportJosn/${child.FileData.Path}`);
        const nestedObj = nested.Content.Content.ObjectData;
        if (child.Name) {
          nestedObj.Name = child.Name;
        }
        nestedObj.Position = child.Position;
        nestedObj.Scale = child.Scale;
        nestedObj.AnchorPoint = child.AnchorPoint;
        nestedObj.ActionTag = child.ActionTag;
        nestedObj.Alpha = child.Alpha;
        await buildNodes(nestedObj, el, actionMap, assetsBase, zIndex + idx + 1);
      } else {
        await buildNodes(child, el, actionMap, assetsBase, zIndex + idx + 1);
      }
    }
  }
}

async function main() {
  const root = document.querySelector("#scene-origin");
  const stage = document.querySelector("#stage");
  if (!root || !stage) return;

  const data = await loadJsonFallback([
    "../res/exportJosn/jackpot.json",
    "/res/exportJosn/jackpot.json",
    "./res/exportJosn/jackpot.json",
  ]);
  const content = data.Content.Content;
  const animation = content.Animation;
  const objectData = content.ObjectData;
  const timelines = buildTimelineMap(animation);

  const animationList = new Map();
  const list = content.AnimationList || animation.AnimationList || [];
  if (!list.length) {
    console.warn("AnimationList is empty; check jackpot.json path and contents.");
  }
  for (const info of list) {
    animationList.set(info.Name, { start: info.StartIndex, end: info.EndIndex });
  }
  console.info("Loaded animations:", Array.from(animationList.keys()));

  const actionMap = new Map();
  await buildNodes(objectData, root, actionMap);

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

  function applyFrame(frame) {
    for (const [tag, elements] of actionMap.entries()) {
      const propMap = timelines.get(tag) || new Map();
      for (const el of elements) {
        const state = { ...el.__baseState };
        for (const [prop, frames] of propMap.entries()) {
          const val = sampleFrame(frames, frame);
          updateProperty(state, prop, val);
        }
        const tex = state.FileData;
        if (tex && tex.Path) {
          const name = baseName(tex.Path);
          if (name) {
            el.style.backgroundImage = `url(assets/${name})`;
          }
        }
        const blend = state.BlendFunc || el.__baseState?.BlendFunc;
        if (blend && blend.Src === 770 && blend.Dst === 1) {
          el.style.mixBlendMode = "screen";
          el.classList.add("blend-add");
        } else {
          el.style.mixBlendMode = "";
          el.classList.remove("blend-add");
        }
        applyTransform(el, state);
      }
    }
  }

  // initial pose
  applyFrame(0);

  let current = null;
  let resolveCurrent = null;
  function play(name) {
    const info = animationList.get(name);
    if (!info) return Promise.reject(new Error(`Unknown animation ${name}`));
    if (resolveCurrent) {
      resolveCurrent();
    }
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

  window.jackpotPlayer = {
    play,
    animations: animationList,
    ready: Promise.resolve(),
  };
  return window.jackpotPlayer;
}

// document.addEventListener("DOMContentLoaded", () => {
//   window.jackpotReady = main().catch((err) => {
//     console.error(err);
//     throw err;
//   });
// });
