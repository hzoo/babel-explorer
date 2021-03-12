import React, { useState, useCallback, useEffect, useRef } from "react";
import * as Babel from "@babel/core";
import styled, { css } from "styled-components";
// import diff_match_patch from "diff-match-patch";
import prettier from "prettier";

import AST from "./AST";
import { Editor } from "./Editor";
import { processOptions } from "../standalone";
import { gzipSize } from "../gzip";

window.babel = Babel;

// TODO: change to babel/babel eventually
const githubPrefix = `https://github.com/hzoo/babel/blob/sandbox/packages/babel-`;

function getTargets(config) {
  if (!config.presets) return "-";

  let targets = config?.presets.filter(
    p => Array.isArray(p) && p[0] === "@babel/preset-env"
  )[0][1].targets;

  if (!targets) {
    return "default (ES5)";
  } else {
    return JSON.stringify(targets, null, 2);
  }
}

const skipKeys = {
  babelPlugin: 1,
  start: 1,
  end: 1,
  loc: 1,
  leadingComments: 1,
  innerComments: 1,
  trailingComments: 1,
  type: 1,
  range: 1,
  comments: 1,
};

function mergeLoc(sourceAST, newAST, cb) {
  sourceAST.start = newAST.start;
  sourceAST.end = newAST.end;
  sourceAST.loc = newAST.loc;

  for (let key of Object.keys(sourceAST)) {
    if (skipKeys[key]) continue;

    let value = sourceAST[key];
    if (!value) continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] && typeof value[i] === "object") {
          if (!newAST[key][i]) continue;

          sourceAST[key][i].start = newAST[key][i].start;
          sourceAST[key][i].end = newAST[key][i].end;
          sourceAST[key][i].loc = newAST[key][i].loc;

          if (value[i].babelPlugin) {
            cb(value[i]);
          }
          mergeLoc(value[i], newAST[key][i], cb);
        }
      }
    } else if (typeof value === "object") {
      if (!newAST[key]) continue;

      sourceAST[key].start = newAST[key].start;
      sourceAST[key].end = newAST[key].end;
      sourceAST[key].loc = newAST[key].loc;

      if (value.babelPlugin) {
        cb(value);
      }
      mergeLoc(value, newAST[key], cb);
    }
  }
}

function traverseAST(sourceAST, cb) {
  for (let key of Object.keys(sourceAST)) {
    if (skipKeys[key]) continue;

    let value = sourceAST[key];
    if (!value) continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] && typeof value[i] === "object") {
          if (!sourceAST[key][i]) continue;

          if (value[i]._originalLoc) {
            cb(value[i]);
          }
          traverseAST(value[i], cb);
        }
      }
    } else if (typeof value === "object") {
      if (value._originalLoc) {
        cb(value);
      }
      traverseAST(value, cb);
    }
  }
}

// No need to hardcode colors, just hash it and add values within some range
// via https://gist.github.com/0x263b/2bdd90886c2036a1ad5bcf06d6e6fb37
function stringtoHSL(string = "default", opts) {
  let h, s, l;
  opts = opts || {};
  opts.hue = opts.hue || [0, 360];
  opts.sat = opts.sat || [75, 100];
  opts.lit = opts.lit || [40, 60];

  const range = function (hash, min, max) {
    const diff = max - min;
    const x = ((hash % diff) + diff) % diff;
    return x + min;
  };

  let hash = 0;
  if (string.length === 0) return hash;
  for (let i = 0; i < string.length; i++) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  h = range(hash, opts.hue[0], opts.hue[1]);
  s = range(hash, opts.sat[0], opts.sat[1]);
  l = range(hash, opts.lit[0], opts.lit[1]);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

function getCSSForTransform(name) {
  return stringtoHSL(name, {
    hue: [180, 360],
    sat: [85, 100],
    lit: [5, 35],
  });
}

// TODO: what to do with this old fn that uses node loc vs. start/end range?
// function fixLoc(loc) {
//   if (loc.ch) return loc;

//   return {
//     line: loc.line - 1,
//     ch: loc.column,
//   };
// }
// function markNodes(cm, nodes) {
//   for (let node of nodes) {
//     // generate highlight color based on plugin name
//     // figure out something better for custom plugins
//     // maybe need to be able to edit it via ui/save settings
//     // can tweak colors too
//     // maybe reuse algo (since deterministic) in the AST node as well and do something with it?
//     cm.doc.markText(fixLoc(node.loc.start), fixLoc(node.loc.end), {
//       css: `background: ${getCSSForTransform(node.babelPlugin[0]?.name)}`,
//     });
//   }
// }

function markRanges(cm, type, ranges, rangeIndexes) {
  cm.doc.getAllMarks().forEach(mark => mark.clear());
  if (!rangeIndexes) {
    for (let range of ranges) {
      markNodeFromIndex(cm, type, range);
    }
  } else {
    for (let index of rangeIndexes) {
      markNodeFromIndex(cm, type, ranges[index]);
    }
  }
}

function markNodeFromIndex(cm, type, data) {
  const start = type === "source" ? data.start : data.outputStart;
  const end = type === "source" ? data.end : data.outputEnd;
  const color = data.color || getCSSForTransform(data.name);
  cm.doc.markText(cm.posFromIndex(start), cm.posFromIndex(end), {
    css: data.css || `background: ${color}`,
  });
}

function shadowMapBasedOnType(node, source, code) {
  if (!node.type) return;

  // 1_000 to 1000
  if (
    node.type === "NumericLiteral" &&
    node?._originalLoc?.extra?.raw?.includes("_")
  ) {
    let original = node._originalLoc.extra.raw;
    let shadowMap = [];
    let index = -1;
    for (let i = 0; i < original.length; i++) {
      if (original[i] !== "_") {
        index++;
        shadowMap.push({
          main: node._originalLoc.start + i,
          shadow: node.start + index,
        });
      }
    }
    return { shadowMap };
    // "1  ;" to "1;"
  } else if (node.type === "ExpressionStatement") {
    if (source[node._originalLoc.end - 1] !== ";" || code[node.end - 1] !== ";")
      return -1;
    return {
      mainStart: node._originalLoc.end - 1,
      mainEnd: node._originalLoc.end,
      shadowStart: node.end - 1,
      shadowEnd: node.end,
      shadowMap: [{ main: node._originalLoc.end - 1, shadow: node.end - 1 }],
    };
  } else if (node._originalLoc.type === "JSXAttribute") {
    // <a b="1"></a> -> _jsx("a", {b: "1"})
    return {
      transformMap: [
        {
          main:
            node?._originalLoc?.name.end +
            source
              .slice(
                node?._originalLoc?.name.end,
                node?._originalLoc?.value.start
              )
              .indexOf("="),
          shadow:
            node.key.end +
            code.slice(node.key.end, node.value.start).indexOf(":"),
          cMain: "=",
          cShadow: ":",
        },
      ],
    };
  } else if (node._originalLoc.type === "JSXIdentifier") {
    return {
      shadowMap: [
        ...Array(node._originalLoc.end - node._originalLoc.start).keys(),
      ].map(main => ({
        main: main + node._originalLoc.start,
        shadow: main + node.start + 1,
      })),
    };
  } else if (node._originalLoc.type === "JSXText") {
    let newStart = node.start + 1;
    let newEnd = node.end - 1;
    return {
      shadowStart: newStart,
      shadowEnd: newEnd,
      shadowMap: [
        ...Array(node._originalLoc.end - node._originalLoc.start).keys(),
      ].map(main => ({
        main: main + node._originalLoc.start,
        shadow: main + newStart,
      })),
    };
  } else if (node.type === "ArrayExpression") {
    let shadowMap = [
      { main: node?._originalLoc?.start, shadow: node.start },
      {
        main: node?._originalLoc?.end - 1,
        shadow: node.end - 1,
      },
    ];
    node.elements.forEach((element, i) => {
      if (i < node?._originalLoc?.elements.length - 1) {
        shadowMap.push({
          main:
            node?._originalLoc?.elements[i].end +
            source
              .slice(
                node?._originalLoc?.elements[i].end,
                node?._originalLoc?.elements[i + 1].start
              )
              .indexOf(","),
          shadow:
            node.elements[i].end +
            code
              .slice(node.elements[i].end, node.elements[i + 1].start)
              .indexOf(","),
        });
      }
    });
    return {
      shadowMap,
    };
  } else if (node.type === "ObjectExpression") {
    let shadowMap = [
      { main: node?._originalLoc?.start, shadow: node.start },
      { main: node?._originalLoc?.end - 1, shadow: node.end - 1 },
    ];
    node.properties.forEach((element, i) => {
      shadowMap.push({
        main:
          node?._originalLoc?.properties[i].key.end +
          source
            .slice(
              node?._originalLoc?.properties[i].key.end,
              node?._originalLoc?.properties[i].value.start
            )
            .indexOf(":"),
        shadow:
          node.properties[i].key.end +
          code
            .slice(node.properties[i].key.end, node.properties[i].value.start)
            .indexOf(":"),
      });
      if (i < node.properties.length - 1) {
        shadowMap.push({
          main:
            node?._originalLoc?.properties[i].value.end +
            source
              .slice(
                node?._originalLoc?.properties[i].value.end,
                node?._originalLoc?.properties[i + 1].key.start
              )
              .indexOf(","),
          shadow:
            node.properties[i].value.end +
            code
              .slice(
                node.properties[i].value.end,
                node.properties[i + 1].key.start
              )
              .indexOf(","),
        });
      }
    });
    return {
      shadowMap,
    };
  } else if (node._originalLoc.type === "VariableDeclaration") {
    let shadowMap = [];
    let transformMap = [];

    // const -> let/var
    node._originalLoc.kind.split("").forEach((main, i) => {
      // if (i < node.kind.length) {
      let inc = Math.min(node.kind.length - 1, i);
      transformMap.push({
        main: node._originalLoc.start + i,
        cMain: main,
        shadow: node.start + inc,
        cShadow: node.kind[i] || "",
      });
      // }
    });

    // var a = 1, b = 2
    // get the = and ,
    let oDeclarations = node?._originalLoc?.declarations;
    let nDeclarations = node.declarations;
    if (oDeclarations?.length === nDeclarations.length) {
      nDeclarations.forEach((element, i) => {
        if (nDeclarations[i].init) {
          shadowMap.push({
            ...(oDeclarations
              ? {
                  main:
                    oDeclarations[i].id.end +
                    source
                      .slice(
                        oDeclarations[i].id.end,
                        oDeclarations[i].init.start
                      )
                      .indexOf("="),
                }
              : {}),
            shadow:
              nDeclarations[i].id.end +
              code
                .slice(nDeclarations[i].id.end, nDeclarations[i].init.start)
                .indexOf("="),
          });
        }
        if (i < nDeclarations.length - 1) {
          let beforeComma = nDeclarations[i].init ? "init" : "id";
          shadowMap.push({
            ...(oDeclarations
              ? {
                  main:
                    oDeclarations[i][beforeComma].end +
                    source
                      .slice(
                        oDeclarations[i][beforeComma].end,
                        oDeclarations[i + 1].id.start
                      )
                      .indexOf(","),
                }
              : {}),
            shadow:
              nDeclarations[i][beforeComma].end +
              code
                .slice(
                  nDeclarations[i][beforeComma].end,
                  nDeclarations[i + 1].id.start
                )
                .indexOf(","),
          });
        }
      });
    }

    if (
      source[node._originalLoc.end - 1] === ";" &&
      code[node.end - 1] === ";"
    ) {
      shadowMap.push({ main: node._originalLoc.end - 1, shadow: node.end - 1 });
    }
    return {
      shadowMap,
      transformMap,
    };
  } else if (
    node.type === "Identifier" ||
    node.type === "StringLiteral" ||
    node.type === "BooleanLiteral" ||
    node.type === "NumericLiteral"
  ) {
    return;
  } else {
    console.error("unsupported", node._originalLoc.type);
    return -1;
  }
}

function CompiledOutput({
  source,
  sourceAST,
  parserError,
  customPlugin,
  config,
  onConfigChange,
  removeConfig,
  index,
  sourceSelection,
  canvas,
}) {
  const [cursor, setCursor] = useState(null);
  const outputCursor = useDebounce(cursor, 100);
  const [showConfig, toggleConfig] = useState(false);
  const [outputEditor, setOutputEditor] = useState(null);
  const [compiled, setCompiled] = useState({
    transformedNodes: [],
    ranges: [],
  });
  const [gzip, setGzip] = useState(null);
  const sourceCursor = useDebounce(sourceSelection, 100);
  const [lastRange, setLastRange] = useState(null);

  // highlight all nodes. and either
  // highlight corresponding source code when clicking on output
  // highlight corresponding output code when selecting source
  useEffect(() => {
    if (!outputEditor || !compiled.ranges) return;
    let index;
    let sourceChange = sourceCursor && window.sourceEditor.hasFocus();
    let outputChange = outputCursor && outputEditor.hasFocus();
    if (sourceChange) {
      // range -
      // head: Pos {line: 6, ch: 1, sticky: "before", xRel: 146.296875}
      // anchor: Pos {line: 13, ch: 0, sticky: "after", xRel: 133}
      const selectRange = sourceCursor.ranges[0];
      index = window.sourceEditor.doc.indexFromPos(selectRange.head);
    } else if (outputChange) {
      index = outputEditor.doc.indexFromPos(outputCursor);
    } else {
      outputEditor.doc.getAllMarks().forEach(mark => mark.clear());
      markRanges(outputEditor, "output", compiled.ranges);
      markRanges(window.sourceEditor, "source", compiled.ranges);
      return;
    }

    let lastRange;
    let containingRanges = [];
    for (let i = 0; i < compiled.ranges.length; i++) {
      const range = compiled.ranges[i];
      const start = sourceChange ? range.start : range.outputStart;
      const end = sourceChange ? range.end : range.outputEnd;
      if (index >= start && index <= end) {
        lastRange = i;
        containingRanges.push(i);
      } else if (index < start) {
        break;
      }
    }
    // if not, just highlight everything?
    if (!compiled.ranges[lastRange]) {
      if (sourceChange) {
        // TODO: highlight source side as well
        outputEditor.doc.getAllMarks().forEach(mark => mark.clear());
        markRanges(outputEditor, "output", compiled.ranges);
        markRanges(window.sourceEditor, "source", compiled.ranges);
      }
      return;
    }

    let { start, end, outputStart, outputEnd } = compiled.ranges[lastRange];

    setLastRange(lastRange);

    // re-highlight source
    markRanges(
      window.sourceEditor,
      "source",
      compiled.ranges,
      containingRanges
    );

    // highlight output
    markRanges(outputEditor, "output", compiled.ranges, containingRanges);

    // only scroll if off screen maybe, or significant?
    if (sourceChange) {
      const from = outputEditor.posFromIndex(outputStart);
      const to = outputEditor.posFromIndex(outputEnd);
      outputEditor.scrollIntoView({ from, to }, window.innerHeight / 3);
    } else {
      const from = window.sourceEditor.posFromIndex(start);
      const to = window.sourceEditor.posFromIndex(end);
      window.sourceEditor.scrollIntoView({ from, to }, window.innerHeight / 3);
    }
  }, [outputEditor, sourceCursor, outputCursor, compiled.ranges]);

  useEffect(() => {
    if (parserError) {
      setCompiled({
        code: parserError,
        error: true,
      });
      return;
    }
    try {
      let transformedNodes = [];
      let ranges = [];
      let shadowIndexesMap = [];
      // retain the AST to use the metadata that has been added to nodes
      let { code, ast, map } = Babel.transformFromAstSync(
        sourceAST,
        source,
        processOptions(config, customPlugin)
      );
      // prettify?
      // code = prettier.format(code, {
      //   parser() {
      //     return Babel.parse(code, processOptions(config, customPlugin));
      //   },
      // });
      // reparse the compiled output to get loc data
      let newAST = Babel.parse(code, processOptions(config, customPlugin));
      window.sourceEditor.doc.getAllMarks().forEach(mark => mark.clear());
      // merge the 2 ASTs by replacing incomplete loc data
      mergeLoc(ast, newAST, node => {
        let loc = node.loc;
        // sort the nodes in nested order
        let added = transformedNodes.some((existingNode, i) => {
          if (
            loc.start.line < existingNode.loc.start.line ||
            (loc.start.line === existingNode.loc.start.line &&
              loc.start.column <= existingNode.loc.start.column &&
              loc.end.line > existingNode.loc.end.line) ||
            (loc.end.line === existingNode.loc.end.line &&
              loc.end.column >= existingNode.loc.end.column)
          ) {
            transformedNodes.splice(i, 0, node);
            return true;
          }
          return false;
        });
        if (!added) transformedNodes.push(node);

        // add source ranges
        for (let i = 0; i < node.babelPlugin.length; i++) {
          const metadata = node.babelPlugin[i];
          let rangesAdded = ranges.some((existingRange, rangeIndex) => {
            if (
              metadata.start < existingRange.start ||
              (metadata.start === existingRange.start &&
                metadata.end <= existingRange.end)
            ) {
              ranges.splice(rangeIndex, 0, {
                outputStart: node.start,
                outputEnd: node.end,
                ...metadata,
              });
              return true;
            }
            return false;
          });
          if (!rangesAdded)
            ranges.push({
              outputStart: node.start,
              outputEnd: node.end,
              ...metadata,
            });

          // color the source with the same color as output
          markNodeFromIndex(window.sourceEditor, "source", metadata);
        }
      });

      traverseAST(ast, node => {
        let map = shadowMapBasedOnType(node, source, code);
        if (map !== -1) {
          shadowIndexesMap.push({
            ...(node._originalLoc.start !== undefined
              ? {
                  type: node._originalLoc.type,
                  mainStart: node._originalLoc.start,
                  mainEnd: node._originalLoc.end,
                  source: source.slice(
                    node._originalLoc.start,
                    node._originalLoc.end
                  ),
                }
              : {}),
            // shadow: code.slice(node.start, node.end),
            shadowStart: node.start,
            shadowEnd: node.end,
            ...map,
          });
        }
      });

      gzipSize(code).then(s => setGzip(s));
      window.ranges = ranges;
      setCompiled({
        code,
        size: new Blob([code], { type: "text/plain" }).size,
        transformedNodes,
        shadowIndexesMap,
        ranges,
        ast,
      });
    } catch (e) {
      if (!e.stack.includes("SyntaxError")) console.warn(e.stack);
      setCompiled({
        code: e.message,
        error: true,
      });
    }
  }, [config, sourceAST, parserError, customPlugin]);

  let fileUrl =
    lastRange && compiled.ranges
      ? compiled.ranges[lastRange]?.file?.match(/babel-(.+):(\d+):(\d+)$/)
      : "";

  useEffect(() => {
    if (source && compiled.code && !compiled.error) {
      initialize(
        canvas.current,
        source,
        compiled.code,
        compiled.shadowIndexesMap
      );
    }
  }, [compiled]);

  return (
    <Wrapper>
      {showConfig ? (
        <Column>
          <Config
            value={
              config === Object(config)
                ? JSON.stringify(config, null, "\t")
                : config
            }
            onChange={onConfigChange}
            docName="config.json"
            config={{ mode: "application/json" }}
          />
        </Column>
      ) : null}
      <Column>
        <div style={{ textAlign: "center" }}>
          Target: {`${getTargets(config)}`}
        </div>
        <Code
          value={compiled?.code ?? ""}
          docName="result.js"
          config={{ readOnly: true, lineWrapping: true }}
          isError={compiled?.error ?? false}
          getEditor={editor => {
            window["outputEditor" + String(index)] = editor;
            setOutputEditor(editor);
          }}
          onCursor={data => setCursor(data)}
        />
      </Column>
      <FileSize>
        {compiled?.size}b, {gzip}b{" "}
        <button onClick={() => toggleConfig(!showConfig)}>Show Config</button>
        {fileUrl ? (
          <button style={{ background: "#f5da55" }}>
            {window.location.hostname === "localhost" ? (
              <a href={compiled.ranges[lastRange].file}>Open File</a>
            ) : (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`${githubPrefix}${fileUrl[1]}#L${fileUrl[2]}`}
              >
                Open GitHub
              </a>
            )}
          </button>
        ) : null}
      </FileSize>
      <Toggle onClick={removeConfig} />
    </Wrapper>
  );
}

export default function App({
  defaultSource,
  defaultBabelConfig,
  defCustomPlugin,
  gist,
}) {
  const [source, setSource] = React.useState(defaultSource);
  const [enableCustomPlugin, toggleCustomPlugin] = React.useState(gist);
  const [customPlugin, setCustomPlugin] = React.useState(defCustomPlugin);
  const debouncedPlugin = useDebounce(customPlugin, 125);
  const [babelConfig, setBabelConfig] = useState(
    Array.isArray(defaultBabelConfig)
      ? defaultBabelConfig
      : [defaultBabelConfig]
  );
  const [size, setSize] = useState(null);
  const [gzip, setGzip] = useState(null);
  const debouncedSource = useDebounce(source, 125);
  const [ast, setAST] = React.useState(null);
  const [parserError, setParserError] = React.useState(null);
  const [showAST, toggleAST] = useState(false); // TODO: false
  const [sourceSelection, setSelection] = useState(null);

  const updateBabelConfig = useCallback((config, index) => {
    setBabelConfig(configs => {
      const newConfigs = [...configs];
      newConfigs[index] = config;

      return newConfigs;
    });
  }, []);

  const removeBabelConfig = useCallback(index => {
    setBabelConfig(configs => configs.filter((c, i) => index !== i));
  }, []);

  // can run prettier on source to make diff nicer?
  const prettify = () => {
    let pretty = prettier.format(debouncedSource, {
      parser() {
        return ast;
      },
    });
    setSource(pretty);
  };

  useEffect(() => {
    try {
      let sourceAST = Babel.parse(
        debouncedSource,
        processOptions({}, enableCustomPlugin ?? debouncedPlugin)
      );

      setAST(sourceAST);
      setParserError(null);
    } catch (e) {
      setParserError(e.message);
    }
    let size = new Blob([debouncedSource], { type: "text/plain" }).size;
    setSize(size);
    gzipSize(debouncedSource).then(s => setGzip(s));
  }, [debouncedSource, debouncedPlugin]);

  const canvas = useRef(null);

  return (
    <>
      <Root>
        <Section>
          {/* <Actions>
          <button
            onClick={() =>
              setBabelConfig(configs => [
                ...configs,
                configs[configs.length - 1],
              ])
            }
          >
            Add New Config
          </button>
        </Actions> */}

          {enableCustomPlugin && (
            <Column>
              <Code
                value={customPlugin}
                onChange={val => setCustomPlugin(val)}
                docName="plugin.js"
              />
              <Toggle onClick={() => toggleCustomPlugin(false)} />
            </Column>
          )}
          <Wrapper>
            <Column>
              <div style={{ textAlign: "center" }}>
                Source{" "}
                <button
                  style={{ background: "#f5da55" }}
                  onClick={() => prettify()}
                >
                  Prettify
                </button>
              </div>
              <Code
                style={{ overflowY: "auto" }}
                value={source}
                onChange={val => {
                  setSource(val);
                }}
                docName="source.js"
                getEditor={editor => {
                  window.sourceEditor = editor;
                }}
                onSelection={data => {
                  // the selection that is done when you click in the output is also fired
                  if (data.origin === undefined) return;
                  setSelection(data);
                }}
              />
              {/* <FileSize>
                {size}b, {gzip}b
                <button onClick={() => toggleCustomPlugin(!enableCustomPlugin)}>
                  Show Plugin
                </button>
                <button onClick={() => toggleAST(!showAST)}>Show AST</button>
              </FileSize> */}
              {showAST && ast ? <AST ast={ast}></AST> : null}
            </Column>
          </Wrapper>
          {ast &&
            babelConfig.map((config, index) => {
              return (
                <CompiledOutput
                  source={debouncedSource}
                  sourceAST={ast}
                  sourceSelection={sourceSelection}
                  parserError={parserError}
                  customPlugin={
                    enableCustomPlugin ? debouncedPlugin : undefined
                  }
                  config={config}
                  key={index}
                  index={index}
                  onConfigChange={config => updateBabelConfig(config, index)}
                  removeConfig={() => removeBabelConfig(index)}
                  canvas={canvas}
                />
              );
            })}
        </Section>
      </Root>
      <canvas
        width="1000"
        height="1200"
        ref={canvas}
        style={{ background: "rgba(0, 0, 0, 0.1)" }}
      ></canvas>
    </>
  );
}

// UTILS

function Toggle(props) {
  return <ToggleRoot {...props}>x</ToggleRoot>;
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [delay, value]);

  return debouncedValue;
}

// STYLES

const Root = styled.div`
  display: flex;
  flex-direction: column;
  // height: 100%;
  // height: 100vh;
  padding: 4px;

  font-family: sans-serif;
  background-color: #24282a;
  color: white;
  font-family: Menlo;
  font-size: 14px;
  margin: 0;
  --red: rgba(240, 52, 52, 0.2);
`;

const Section = styled.section`
  display: flex;
  height: 100%;
  flex: 1;
  position: relative;
`;

const Column = styled.section`
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  position: relative;
`;

const Wrapper = styled.div`
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: row;
  width: 100%;
  padding: 0.25rem 1rem 0.75rem;
  position: relative;

  & + & {
    margin-top: 1px;
  }
`;

const Config = styled(Editor)`
  padding: 4px;
`;

const Code = styled(Editor)`
  padding: 4px;
  width: 100%;

  ${p =>
    p.isError &&
    css`
      background: rgba(234, 76, 137, 0.2);
    `};
`;

const FileSize = styled.div`
  background-color: rgba(255, 255, 255, 0.1);
  border: 0;
  border-radius: 0.5rem;
  bottom: 1rem;
  color: #888;
  font-size: 0.75rem;
  padding: 0.2rem;
  position: absolute;
  right: 2rem;
  z-index: 2;
`;

const ToggleRoot = styled.div`
  align-items: center;
  cursor: pointer;
  display: flex;
  height: 20px;
  justify-content: center;
  padding: 0.25rem;
  position: absolute;
  right: 1px;
  transition: color 0.25s ease-out;
  top: -1px;
  width: 20px;
  z-index: 2;

  &:hover {
    color: red;
  }
`;

// const Actions = styled(Wrapper)`
//   border-bottom: 1px solid rgba(36, 40, 42, 1);
//   padding: 1rem;

//   button {
//     margin-left: 1rem;
//   }
// `;

function createRenderer(canvas) {
  function setDPI(canvas, dpi) {
    if (!canvas.style.width) {
      canvas.style.width = canvas.width + "px";
      canvas.style.height = canvas.height + "px";
      // Resize canvas and scale future draws..
      var scaleFactor = dpi / 96;
      canvas.width = Math.ceil(canvas.width * scaleFactor);
      canvas.height = Math.ceil(canvas.height * scaleFactor);
      var ctx = canvas.getContext("2d");
      ctx.scale(scaleFactor, scaleFactor);
    }
  }
  setDPI(canvas, 192);

  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "1em Operator Mono SSm, monospace";
  const metrics = ctx.measureText("m");
  // console.log(metrics);

  const maxWidth = 700;
  function computePositions(chars) {
    let { x, y } = chars[0];
    for (let char of chars) {
      char.x = x;
      char.y = y;
      if (char.c === "\n" || char.x > maxWidth) {
        x = 0;
        y += metrics.fontBoundingBoxDescent + 1;
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
          y < char.y + metrics.fontBoundingBoxDescent + 1
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
          ctx.fillRect(x, y, metrics.width, 18);
          ctx.restore();
        }
        ctx.fillStyle = char.fillStyle || "black";
        ctx.fillText(char.c, x, y);
      }
    },
    ctx,
  };
}

let Renderer;

function initialize(canvas, mainText, shadowText, shadowIndexesMap) {
  // abcde
  const mainChars = mainText
    .split("")
    .map(c => ({ c, x: 0, y: 0, color: c.match(/[a-zA-Z0-9_]/) }));
  const shadowChars = shadowText
    .split("")
    .map(c => ({ c, x: 0, y: 0, color: c.match(/[a-zA-Z0-9_]/) }));
  Renderer = Renderer || createRenderer(canvas);

  const Animator = (function () {
    const renderFrame = (function () {
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
            if (char.color) {
              char.bgStyle = `rgba(255, 192, 203, ${animate(0.3, 1, t)})`;
            }
            if (char.shadows) {
              char.shadows.forEach(shadow => {
                const extraIndex = shadowChars[shadow];
                extraShadows.push({
                  animX: animate(char.x, extraIndex.x, t),
                  animY: animate(char.y, extraIndex.y, t),
                  ...extraIndex,
                });
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

            if (char.color) {
              char.bgStyle = `rgba(156, 38, 176, ${animate(0.1, 0.5, t)})`;
            }
          } else {
            char.fillStyle = `rgba(0, 0, 0, ${animate(1, 0, t)})`;
          }
        }

        for (let char of createCharRuns) {
          char.fillStyle = `rgba(0, 0, 0, ${animate(0, 1, t)})`;
        }
        Renderer.render(createCharRuns);

        for (let char of createNewChars) {
          char.fillStyle = `rgba(0, 0, 0, ${animate(0, 1, t)})`;
          if (char.color) {
            char.bgStyle = `rgba(102, 187, 106, ${animate(0, 0.2, t)})`;
          }
        }
        Renderer.render(createNewChars);

        Renderer.render(mainChars);
        Renderer.render(extraShadows);
      };
    })();

    let target = 0,
      rate,
      slowMode;

    let t = 0;
    requestAnimationFrame(timestamp => {
      (function frame(prevTimestamp, timestamp) {
        if (Math.abs(target - t) > 0.01) {
          t +=
            ((target - t) / (timestamp - prevTimestamp)) *
            (slowMode ? rate / 4 : rate);

          renderFrame(t);
        } else {
          // FIXME: stop animation
        }

        requestAnimationFrame(newTimestamp => frame(timestamp, newTimestamp));
      })(timestamp - 20, timestamp);
    });

    return {
      get target() {
        return target;
      },
      set target(t) {
        target = t;
        // FIXME: dynamically stop/start animation
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

  console.log(shadowIndexesMap);

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

  const createCharRuns = (() => {
    // transformed/same chars
    shadowIndexesMap = shadowIndexesMap.filter(a => a.source);

    // filter down from output
    let result = [...shadowChars];
    for (const [i, value] of shadowIndexesMap.entries()) {
      let { mainEnd, mainStart, shadowMap, transformMap } = value;

      if (shadowMap || transformMap) {
        (shadowMap || []).forEach(({ main, shadow }) => {
          if (mainChars[main]) {
            mainChars[main].shadowIndex = shadow;
            result[shadow] = undefined;
          } else {
            console.error(value);
          }
        });
        (transformMap || []).forEach(({ main, shadow, cMain, cShadow }) => {
          mainChars[main].transform = { shadow, cMain, cShadow };
          result[shadow] = undefined;
        });
      } else {
        let inc = 0;
        while (mainStart + inc < mainEnd) {
          if (mainChars[mainStart + inc].shadowIndex === undefined) {
            mainChars[mainStart + inc].shadowIndex = value.shadowStart + inc;
          } else if (!mainChars[mainStart + inc].shadows) {
            mainChars[mainStart + inc].shadows = [value.shadowStart + inc];
          } else {
            mainChars[mainStart + inc].shadows.push(value.shadowStart + inc);
          }
          result[value.shadowStart + inc] = undefined;
          inc++;
        }
      }
    }
    result = result.filter(a => a);
    return result;
  })();
}
