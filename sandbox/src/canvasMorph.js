function createRenderer(canvas) {
  function setDPR(canvas, dpr = window.devicePixelRatio || 1) {
    if (!canvas.style.width) {
      // Get the device pixel ratio, falling back to 1.
      canvas.style.width = canvas.width + "px";
      canvas.style.height = canvas.height + "px";
      // Resize canvas and scale future draws..
      // var scaleFactor = dpi / 96;
      canvas.width = Math.ceil(canvas.width * dpr);
      canvas.height = Math.ceil(canvas.height * dpr);
      var ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
    }
  }
  setDPR(canvas, 4);

  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "1em Operator Mono SSm, monospace";
  const metrics = ctx.measureText("m");
  const lineHeight = metrics.actualBoundingBoxDescent * 1.4;

  const maxWidth = 700;
  function computePositions(chars) {
    let { x, y } = chars[0];
    for (let char of chars) {
      char.x = x;
      char.y = y;
      if (char.c === "\n" || char.x > maxWidth) {
        x = 0;
        y += lineHeight;
      } else {
        x += metrics.width;
      }
    }
  }

  return {
    computePositions,
    charIndexUnder(chars, x, y) {
      for (let [i, char] of chars.entries()) {
        if (
          char.x < x &&
          char.y < y &&
          x < char.x + metrics.width &&
          y < char.y + lineHeight
        ) {
          return i;
        }
      }
    },
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    render(chars, startIdx = 0, endIdx = chars.length - 1) {
      for (let i = startIdx; i <= endIdx; i++) {
        const char = chars[i];
        if (char.c === "") continue;

        const x = "animX" in char ? char.animX : char.x;
        const y = "animY" in char ? char.animY : char.y;
        if (char.bgStyle) {
          ctx.save();
          ctx.fillStyle = char.bgStyle;
          ctx.fillRect(x, y, metrics.width, lineHeight);
          ctx.restore();
        }
        ctx.fillStyle = char.fillStyle || char.color || "black";
        ctx.fillText(char.c, x, y);
      }
    },
    ctx,
  };
}

//stackoverflow.com/a/21648508
// rgba(251,175,255,1)
function hexToRgb(hex) {
  var c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split("");
    if (c.length == 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = "0x" + c.join("");
    return "rgb(" + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(",") + ")";
  }
  throw new Error("Bad Hex");
}

let Renderer;

export default function initCanvas(
  canvas,
  mainText,
  shadowText,
  shadowIndexesMap,
  shiki
) {
  let mainChars = [];
  let shadowChars = [];

  if (!shiki) {
    mainChars = mainText
      .split("")
      .map(c => ({ c, x: 0, y: 0, color: c.match(/[a-zA-Z0-9_]/) }));
    shadowChars = shadowText
      .split("")
      .map(c => ({ c, x: 0, y: 0, color: c.match(/[a-zA-Z0-9_]/) }));
  } else {
    const mainLines = shiki.codeToThemedTokens(
      mainText,
      "javascript",
      undefined,
      {
        includeExplanation: false,
      }
    );
    mainLines.forEach((line, i) => {
      line.forEach(token => {
        [...token.content].forEach(c => {
          mainChars.push({ c, x: 0, y: 0, color: hexToRgb(token.color) });
        });
      });
      if (i < mainLines.length - 1)
        mainChars.push({ c: "\n", x: 0, y: 0, color: "rgb(0,0,0)" });
    });

    const shadowLines = shiki.codeToThemedTokens(
      shadowText,
      "javascript",
      undefined,
      {
        includeExplanation: false,
      }
    );
    shadowLines.forEach((line, i) => {
      line.forEach(token => {
        [...token.content].forEach(c => {
          shadowChars.push({ c, x: 0, y: 0, color: hexToRgb(token.color) });
        });
      });
      if (i < shadowLines.length - 1)
        shadowChars.push({ c: "\n", x: 0, y: 0, color: "rgb(0,0,0)" });
    });
  }

  window.mainChars = mainChars;
  window.shadowChars = shadowChars;
  window.shadowIndexesMap = shadowIndexesMap;
  Renderer = Renderer || createRenderer(canvas);

  const Animator = (function () {
    const renderFrame = (function () {
      // straight from https://easings.net/#easeInOutCubic
      function easeInOutCubic(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      }

      function animate(x0, x1, t, ease = easeInOutCubic) {
        return x0 * (1 - ease(t)) + x1 * ease(t);
      }

      return function frame(t) {
        // remove for art*
        Renderer.clear();

        let extraShadows = [];

        for (let char of mainChars) {
          if ("shadowIndex" in char) {
            const shadowChar = shadowChars[char.shadowIndex];
            char.animX = animate(char.x, shadowChar.x, t);
            char.animY = animate(char.y, shadowChar.y, t);

            // char.bgStyle = `rgba(255, 192, 203, ${
            //   t === 0 ? 0 : animate(0, 0.2, t)
            // })`;
            char.fillStyle = t < 0.5 ? char.color : shadowChar.color;
            char.fillStyle = char.color;
            if (char.shadows) {
              char.shadows.forEach(shadow => {
                const extraIndex = shadowChars[shadow];
                if (t > 0.15) {
                  extraShadows.push({
                    animX:
                      t < 0.3
                        ? animate(char.x, shadowChar.x, t)
                        : animate(shadowChar.x, extraIndex.x, t),
                    animY:
                      t < 0.3
                        ? animate(char.y, shadowChar.y, t)
                        : animate(shadowChar.y, extraIndex.y, t),
                    bgStyle:
                      char.color &&
                      `rgba(238, 192, 255, ${
                        t === 0 ? 0 : animate(0, 0.2, t)
                      })`,
                    ...extraIndex,
                  });
                }
              });
            }
          } else if ("transform" in char) {
            const shadowChar = shadowChars[char.transform.shadow];
            if (t > 0.5) {
              char.c = char.transform.cShadow;
            } else {
              char.c = char.transform.cMain;
            }
            char.animX = animate(char.x, shadowChar.x, t);
            char.animY = animate(char.y, shadowChar.y, t);

            char.bgStyle = `rgba(174, 18, 201, ${animate(0, 0.4, t)})`;
            char.fillStyle = t < 0.5 ? char.color : shadowChar.color;
          } else {
            // char.fillStyle = `rgba(0, 0, 0, ${animate(1, 0, t)})`;
            char.fillStyle = `rgba${char.color.slice(3, -1)},${animate(
              1,
              0,
              t
            )})`;
          }
        }

        for (let char of createCharRuns) {
          // char.fillStyle = `rgba(0, 0, 0, ${animate(0, 1, t)})`;
          char.fillStyle = `rgba${char.color.slice(3, -1)},${animate(
            0,
            1,
            t
          )})`;
        }
        Renderer.render(createCharRuns);

        for (let char of createNewChars) {
          // char.fillStyle = `rgba(0, 0, 0, ${animate(0, 1, t)})`;
          char.fillStyle = `rgba${char.color.slice(3, -1)},${animate(
            0,
            1,
            t
          )})`;
          // char.bgStyle = `rgba(102, 187, 106, ${animate(0, 0.5, t)})`;
        }
        Renderer.render(createNewChars);

        Renderer.render(extraShadows);
        Renderer.render(mainChars);
      };
    })();

    let target = 0,
      rate,
      slowMode;
    let t = 0;

    let animationId = 0;
    function startAnimation() {
      if (animationId !== 0) return;
      animationId = requestAnimationFrame(timestamp => {
        (function frame(prevTimestamp, timestamp) {
          if (Math.abs(target - t) > 0.01) {
            t +=
              ((target - t) / (timestamp - prevTimestamp)) *
              (slowMode ? rate / 4 : rate);
            renderFrame(t);

            animationId = requestAnimationFrame(newTimestamp =>
              frame(timestamp, newTimestamp)
            );
          } else {
            // stop animation
            animationId = 0;
          }
        })(timestamp - 20, timestamp);
      });
    }

    return {
      get target() {
        return target;
      },
      set target(t) {
        target = t;
        // dynamically restart animation
        startAnimation();
      },
      get rate() {
        return rate;
      },
      set rate(s) {
        rate = s;
      },
      get slowMode() {
        return slowMode;
      },
      set slowMode(sm) {
        slowMode = sm;
      },
    };
  })();

  Renderer.clear();
  Renderer.computePositions(mainChars);
  Renderer.render(mainChars);
  Renderer.computePositions(shadowChars);

  // canvas.onmousemove = function (e) {
  //   const charIdx = Renderer.charIndexUnder(mainChars, e.offsetX, e.offsetY);
  //   const char = mainChars[charIdx];
  //   if (!char) {
  //     document.body.style.cursor = "auto";
  //     return;
  //   }

  //   document.body.style.cursor = "pointer";
  // };
  canvas.onmousedown = canvas.ontouchstart = function (e) {
    Animator.target = 1;
    Animator.rate = 1;
  };
  canvas.onmouseup = canvas.ontouchend = function (e) {
    Animator.target = 0;
    Animator.rate = 2;
  };
  document.onkeydown = document.onkeyup = function (e) {
    Animator.slowMode = e.shiftKey;
  };

  const createNewChars = (() => {
    // only newly inserted chars
    let newIndexesMap = shadowIndexesMap.filter(a => a.source === undefined);
    const result = [];
    for (let { shadowStart, shadowEnd, shadowMap } of newIndexesMap) {
      if (!shadowMap) {
        for (let index = shadowStart; index < shadowEnd; index++) {
          result.push({
            ...shadowChars[index],
          });
        }
      } else {
        shadowMap.forEach(({ shadow }) => {
          result.push({
            ...shadowChars[shadow],
          });
        });
      }
    }
    return result;
  })();

  function setShadows(mainChars, mainIndex, shadowIndex) {
    if (mainChars[mainIndex].shadowIndex === undefined) {
      mainChars[mainIndex].shadowIndex = shadowIndex;
    } else if (!mainChars[mainIndex].shadows) {
      mainChars[mainIndex].shadows = [shadowIndex];
    } else {
      mainChars[mainIndex].shadows.push(shadowIndex);
    }
  }

  const createCharRuns = (() => {
    // transformed/same chars
    shadowIndexesMap = shadowIndexesMap.filter(a => a.source);

    // filter down from output
    let result = [...shadowChars];
    for (const [i, value] of shadowIndexesMap.entries()) {
      let {
        mainEnd,
        mainStart,
        shadowStart,
        shadowMap,
        transformMap,
        source,
      } = value;

      if (shadowMap || transformMap) {
        (shadowMap || []).forEach(({ main, shadow }, i) => {
          if (mainChars[main] && shadow !== undefined) {
            // mainChars[main].shadowIndex = shadow;
            setShadows(mainChars, main, shadow);
            result[shadow] = undefined;
            shadowMap[i].char = shadowText[shadow];
          } else {
            if (main !== false) {
              console.error(
                `mainChars[main] undefined: ${JSON.stringify(value)}`
              );
            }
          }
        });
        (transformMap || []).forEach(({ main, shadow, cMain, cShadow }) => {
          mainChars[main].transform = { shadow, cMain, cShadow };
          result[shadow] = undefined;
        });
      } else {
        let inc = 0;
        while (mainStart + inc < mainEnd) {
          setShadows(mainChars, mainStart + inc, shadowStart + inc);
          result[value.shadowStart + inc] = undefined;
          inc++;
        }
      }
    }
    result = result.filter(a => a);
    return result;
  })();
}
