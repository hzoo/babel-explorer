import React from "react";
import ReactDOM from "react-dom";
import { App } from "./components/App";

const SOURCE = `const foo = async (...a) => \`\${a?.b}\`;
class A {
  async a() {
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
    ],
    plugins: [["@babel/plugin-transform-runtime"]],
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
    ],
    plugins: [["@babel/plugin-transform-runtime"]],
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
