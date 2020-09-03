import React, { useState, useCallback, useEffect } from "react";
import * as Babel from "@babel/core";
import traverse from "@babel/traverse";
import styled, { css } from "styled-components";

import AST from "./AST";
import { Editor } from "./Editor";
import { processOptions } from "../standalone";
import { gzipSize } from "../gzip";

window.babel = Babel;

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

function mergeLoc(sourceAST, newAST, cb) {
  sourceAST.start = newAST.start;
  sourceAST.end = newAST.end;
  sourceAST.loc = newAST.loc;

  for (let key of Object.keys(sourceAST)) {
    if (key === "babelPlugin" || key === "loc") continue;

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
            cb(value[i], newAST[key][i].loc);
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
        cb(value, newAST[key].loc);
      }
      mergeLoc(value, newAST[key], cb);
    }
  }
}

function fixLoc(loc) {
  return {
    line: loc.line - 1,
    ch: loc.column,
  };
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

function findClosestTransformedNode(ast, index) {
  let node;
  traverse(ast, {
    enter(path) {
      if (index < path.node.start) {
        path.skip();
      } else if (index > path.node.end) {
        path.skip();
      } else if (path.node.babelPlugin) node = path.node;
    },
  });

  return node;
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
}) {
  const [cursor, setCursor] = useState(null);
  const debouncedCursor = useDebounce(cursor, 100);
  const [showConfig, toggleConfig] = useState(false);
  const [outputEditor, setOutputEditor] = useState(null);
  const [compiled, setCompiled] = useState({ transformedNodes: [] });
  const [gzip, setGzip] = useState(null);

  useEffect(() => {
    if (!outputEditor || !debouncedCursor) return;
    if (window.sourceEditor.hasFocus()) return;
    // Object { line: 0, ch: 2, sticky: "before", xRel: -4 }
    let outputIndex = outputEditor.doc.indexFromPos(debouncedCursor);
    let node = findClosestTransformedNode(compiled.ast, outputIndex);
    if (node) {
      const start = node.babelPlugin[0].start;
      const end = node.babelPlugin[0].end;
      if (!start || !end) {
        console.warn(
          `BUG: no start/end for ${JSON.stringify(debouncedCursor)}`
        );
        return;
      }
      const from = window.sourceEditor.posFromIndex(node.babelPlugin[0].start);
      const to = window.sourceEditor.posFromIndex(node.babelPlugin[0].end);
      window.sourceEditor.doc.setSelection(from, to, { scroll: false });
      window.sourceEditor.scrollIntoView({ from, to }, window.innerHeight / 3);
    }
  }, [outputEditor, debouncedCursor, compiled.ast]);

  useEffect(() => {
    if (!outputEditor || !compiled.transformedNodes) return;
    for (let node of compiled.transformedNodes) {
      // generate highlight color based on plugin name
      // figure out something better for custom plugins
      // maybe need to be able to edit it via ui/save settings
      // can tweak colors too
      // maybe reuse algo (since deterministic) in the AST node as well and do something with it?
      outputEditor.doc.markText(fixLoc(node.loc.start), fixLoc(node.loc.end), {
        css: `background: ${stringtoHSL(node.babelPlugin[0]?.name, {
          hue: [180, 360],
          sat: [85, 100],
          lit: [5, 35],
        })}`,
      });
    }
  }, [outputEditor, compiled.transformedNodes]);

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
      const { code, ast } = Babel.transformFromAstSync(
        sourceAST,
        source,
        processOptions(config, customPlugin)
      );
      let newAST = Babel.parse(code, processOptions(config, customPlugin));
      mergeLoc(ast, newAST, (value, loc) => {
        let node = { ...value, loc };
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
      });
      gzipSize(code).then(s => setGzip(s));
      setCompiled({
        code,
        size: new Blob([code], { type: "text/plain" }).size,
        transformedNodes,
        ast,
      });
    } catch (e) {
      if (!e.stack.includes("SyntaxError")) console.warn(e.stack);
      setCompiled({
        code: e.message,
        error: true,
      });
    }
  }, [source, config, sourceAST, parserError, customPlugin]);

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
            window[outputEditor + String(index)] = editor;
            setOutputEditor(editor);
          }}
          onCursor={data => setCursor(data)}
        />
      </Column>
      <FileSize>
        {compiled?.size}b, {gzip}b{" "}
        <button onClick={() => toggleConfig(!showConfig)}>Show Config</button>
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
  const [showAST, toggleAST] = useState(true); // TODO: false

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

  useEffect(() => {
    try {
      let sourceAST = Babel.parse(
        debouncedSource,
        processOptions({}, debouncedPlugin)
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

  return (
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
            <div style={{ textAlign: "center" }}>Source</div>
            <Code
              style={{ overflowY: "auto" }}
              value={source}
              onChange={val => setSource(val)}
              docName="source.js"
              getEditor={editor => {
                window.sourceEditor = editor;
              }}
            />
            <FileSize>
              {size}b, {gzip}b
              <button onClick={() => toggleCustomPlugin(!enableCustomPlugin)}>
                Show Plugin
              </button>
              <button onClick={() => toggleAST(!showAST)}>Show AST</button>
            </FileSize>
            {showAST && ast ? <AST ast={ast}></AST> : null}
          </Column>
        </Wrapper>
        {ast &&
          babelConfig.map((config, index) => {
            return (
              <CompiledOutput
                source={debouncedSource}
                sourceAST={ast}
                parserError={parserError}
                customPlugin={enableCustomPlugin ? debouncedPlugin : undefined}
                config={config}
                key={index}
                index={index}
                onConfigChange={config => updateBabelConfig(config, index)}
                removeConfig={() => removeBabelConfig(index)}
              />
            );
          })}
      </Section>
    </Root>
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
  height: 100vh;
  padding: 4px;
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
