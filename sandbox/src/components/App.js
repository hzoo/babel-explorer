import React, { useState, useCallback, useEffect } from "react";
import * as Babel from "@babel/core";
import traverse from "@babel/traverse";
import styled, { css } from "styled-components";

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
    let value = sourceAST[key];
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] && typeof value[i] === "object") {
          if (value[i].babelPlugin) {
            cb(value[i], newAST[key][i].loc);
          }
          if (newAST?.[key]?.[i]) mergeLoc(value[i], newAST[key][i], cb);
        }
      }
    } else if (value && typeof value === "object") {
      if (value.babelPlugin) {
        cb(value, newAST[key].loc);
      }
      if (newAST[key]) mergeLoc(value, newAST[key], cb);
    }
  }
}

function fixLoc(loc) {
  return {
    line: loc.line - 1,
    ch: loc.column,
  };
}

let proposalMap = {
  "transform-numeric-separator": "background: rgba(42, 187, 155, 0.3)",
  "transform-runtime": "background: rgba(42, 187, 155, 0.6)",
  "transform-classes": "background: rgba(255, 0, 0, 0.2)",
  "proposal-optional-chaining": "background: rgba(44, 130, 201, 0.2)",
  "transform-template-literals": "background: rgba(24, 240, 57, 0.3)",
  "builder-react-jsx": "background: rgba(223, 125, 41, 0.2)",
  "transform-for-of": "background: rgba(21, 132, 196, 0.5)",
  "transform-parameters": "background: rgba(245, 218, 85, 0.2)",
  regenerator: "background: rgba(107, 231, 132, 0.2)",
  "transform-async-to-generator": "background: rgba(107, 231, 132, 0.5)",
  "transform-spread": "background: rgba(233, 212, 96, 0.2)",
  "transform-shorthand-properties": "background: rgba(42, 187, 155, 0.4)",
  "transform-arrow-functions": "background: rgba(42, 187, 155, 0.5)",
  "transform-destructuring": "background: rgba(42, 187, 155, 0.1)",
  "transform-typescript": "background: rgba(42, 187, 155, 0.4)",
  "module-imports": "background: rgba(42, 187, 155, 0.2)",
  "proposal-object-rest-spread": "background: rgba(42, 187, 155, 0.3)",
  "proposal-nullish-coalescing-operator": "background: rgba(233, 212, 96, 0.3)",
  "transform-block-scoping": "background: rgba(21, 132, 196, 0.3)",
  "builder-binary-assignment-operator-visitor":
    "background: rgba(255, 0, 0, 0.3)",
  "proposal-optional-catch-binding": "background: rgba(255, 0, 0, 0.4)",
  "proposal-logical-assignment-operators": "background: rgba(255, 0, 0, 0.5)",
  "create-class-features-plugin": "background: rgba(0, 255, 0, 0.2)",
  "wrap-function": "background: rgba(0, 255, 0, 0.3)",
};

function CompiledOutput({
  source,
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
  const [compiled, setCompiled] = useState({ nodes: [] });
  const [gzip, setGzip] = useState(null);
  const debouncedPlugin = useDebounce(customPlugin, 125);

  useEffect(() => {
    if (!outputEditor || !debouncedCursor) return;
    if (window.sourceEditor.hasFocus()) return;
    // Object { line: 0, ch: 2, sticky: "before", xRel: -4 }
    let outputIndex = outputEditor.doc.indexFromPos(debouncedCursor);
    let node;
    traverse(compiled.ast, {
      enter(path) {
        if (outputIndex < path.node.start) {
          path.skip();
        } else if (outputIndex > path.node.end) {
          path.skip();
        } else if (path.node.babelPlugin) node = path.node;
      },
    });
    if (node?.babelPlugin) {
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
    if (!outputEditor || !compiled.nodes) return;
    for (let node of compiled.nodes) {
      let highlightColor = proposalMap[node.babelPlugin[0]?.name];
      if (highlightColor) {
        outputEditor.doc.markText(
          fixLoc(node.loc.start),
          fixLoc(node.loc.end),
          { css: highlightColor }
        );
      } else {
        console.warn(`UNHANDLED plugin-name ${node.babelPlugin[0].name}`);
        outputEditor.doc.markText(
          fixLoc(node.loc.start),
          fixLoc(node.loc.end),
          { css: "background: rgba(255, 255, 255, 0.2)" }
        );
      }
    }
  }, [outputEditor, compiled.nodes]);

  useEffect(() => {
    try {
      let nodes = [];
      const { code, ast } = Babel.transform(
        source,
        processOptions(config, debouncedPlugin)
      );
      let newAST = Babel.parse(code, processOptions(config, debouncedPlugin));
      mergeLoc(ast, newAST, (value, loc) => {
        let node = { ...value, loc };
        let added = nodes.some((existingNode, i) => {
          if (
            loc.start.line < existingNode.loc.start.line ||
            (loc.start.line === existingNode.loc.start.line &&
              loc.start.column <= existingNode.loc.start.column &&
              loc.end.line > existingNode.loc.end.line) ||
            (loc.end.line === existingNode.loc.end.line &&
              loc.end.column >= existingNode.loc.end.column)
          ) {
            nodes.splice(i, 0, node);
            return true;
          }
          return false;
        });
        if (!added) nodes.push(node);
      });
      gzipSize(code).then(s => setGzip(s));
      setCompiled({
        code,
        size: new Blob([code], { type: "text/plain" }).size,
        nodes,
        ast,
      });
    } catch (e) {
      console.warn(e.stack);
      setCompiled({
        code: e.message,
        error: true,
      });
    }
  }, [source, config, debouncedPlugin]);

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
        <button onClick={() => toggleConfig(!showConfig)}>CONFIG</button>
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
  const [babelConfig, setBabelConfig] = useState(
    Array.isArray(defaultBabelConfig)
      ? defaultBabelConfig
      : [defaultBabelConfig]
  );
  const [size, setSize] = useState(null);
  const [gzip, setGzip] = useState(null);
  const debouncedSource = useDebounce(source, 125);

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

  let results = babelConfig.map((config, index) => {
    return (
      <CompiledOutput
        source={debouncedSource}
        customPlugin={enableCustomPlugin ? customPlugin : undefined}
        config={config}
        key={index}
        index={index}
        onConfigChange={config => updateBabelConfig(config, index)}
        removeConfig={() => removeBabelConfig(index)}
      />
    );
  });

  useEffect(() => {
    let size = new Blob([debouncedSource], { type: "text/plain" }).size;
    setSize(size);
    gzipSize(debouncedSource).then(s => setGzip(s));
  }, [debouncedSource]);

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
        <Column>
          <div style={{ textAlign: "center" }}>Source</div>
          <Code
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
              CUSTOM
            </button>
          </FileSize>
        </Column>
        {results}
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
