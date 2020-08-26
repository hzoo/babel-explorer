import React from "react";
import ReactDOM from "react-dom";
import { App } from "./components/App";

const SOURCE = `const foo = (...a) => \`\${a?.b}\`;
enum Direction {
  Left,
  Up,
  Down,
  Right
}
class A {
  a() {
    for (b of []) {
      \`a\${c?.[1_0_0_0_0]}\`;
      var z = [...f];
    }

    let d = {
      f() {},
      x
    };

    return <a></a>;
  }
}`;
const CONFIG = [
  {
    presets: [
      [
        "@babel/preset-env",
        { loose: true, modules: false, shippedProposals: true },
      ],
      "@babel/preset-react",
      [
        "@babel/preset-typescript",
        {
          isTSX: true,
          allExtensions: true,
          allowDeclareFields: true,
          allowNamespaces: true,
          onlyRemoveTypeImports: true,
        },
      ],
    ],
    plugins: [["@babel/plugin-transform-runtime", { useESModules: true }]],
  },
  {
    presets: [
      [
        "@babel/preset-env",
        {
          loose: true,
          modules: false,
          shippedProposals: true,
          targets: { esmodules: true },
          bugfixes: true,
        },
      ],
      "@babel/preset-react",
      [
        "@babel/preset-typescript",
        {
          isTSX: true,
          allExtensions: true,
          allowDeclareFields: true,
          allowNamespaces: true,
          onlyRemoveTypeImports: true,
        },
      ],
    ],
    plugins: [["@babel/plugin-transform-runtime", { useESModules: true }]],
  },
];
const PLUGIN = `export default function customPlugin(babel) {
  return {
    visitor: {
      Identifier(path) {
        // console.log(path.node.name);
      }
    }
  };
}
`;

ReactDOM.render(
  <React.StrictMode>
    <App
      defaultBabelConfig={CONFIG}
      defaultSource={SOURCE}
      defCustomPlugin={PLUGIN}
    />
  </React.StrictMode>,
  document.getElementById("root")
);
