import * as Babel from "@babel/core";
// import metadataPlugin from "./metadataPlugin";

// take from @babel/standalone
import {
  presets as availablePresets,
  plugins as availablePlugins,
} from "./plugins-list";

export function transpilePlugin(pluginString) {
  return Babel.transform(pluginString, {
    babelrc: false,
    configFile: false,
    ast: false,
    highlightCode: false,
    presets: [
      [
        availablePresets["@babel/preset-env"],
        { loose: true, shippedProposals: true },
      ],
      [
        availablePresets["@babel/preset-typescript"],
        {
          isTSX: true,
          allExtensions: true,
          allowDeclareFields: true,
          allowNamespaces: true,
          onlyRemoveTypeImports: true,
        },
      ],
    ],
    // TODO: figure out file url issue
    // plugins: [metadataPlugin],
  }).code;
}

// astexplorer
export default function compileModule(code, globals = {}) {
  const exports = {};
  const module = { exports };
  const globalNames = Object.keys(globals);
  const keys = ["module", "exports", ...globalNames];
  const values = [module, exports, ...globalNames.map(key => globals[key])];
  // eslint-disable-next-line no-new-func
  new Function(keys.join(), code).apply(exports, values);
  return module.exports;
}

export function loadBuiltin(builtinTable, name) {
  if (Array.isArray(name) && typeof name[0] === "string") {
    if (Object.prototype.hasOwnProperty.call(builtinTable, name[0])) {
      return [builtinTable[name[0]]].concat(name.slice(1));
    }
    return;
  } else if (typeof name === "string") {
    return builtinTable[name];
  }
  // Could be an actual preset/plugin module
  return name;
}

export function processOptions(options, customPlugin) {
  if (typeof options === "string") options = JSON.parse(options);

  // Parse preset names
  const presets = (options.presets || []).map(presetName => {
    const preset = loadBuiltin(availablePresets, presetName);

    if (preset) {
      // workaround for babel issue
      // at some point, babel copies the preset, losing the non-enumerable
      // buildPreset key; convert it into an enumerable key.
      if (
        Array.isArray(preset) &&
        typeof preset[0] === "object" &&
        Object.prototype.hasOwnProperty.call(preset[0], "buildPreset")
      ) {
        preset[0] = { ...preset[0], buildPreset: preset[0].buildPreset };
      }
    } else {
      throw new Error(
        `Invalid preset specified in Babel options: "${presetName}"`
      );
    }
    return preset;
  });

  // Parse plugin names
  const plugins = (options.plugins || []).map(pluginName => {
    const plugin = loadBuiltin(availablePlugins, pluginName);

    if (!plugin) {
      throw new Error(
        `Invalid plugin specified in Babel options: "${pluginName}"`
      );
    }
    return plugin;
  });

  if (customPlugin) {
    customPlugin = transpilePlugin(customPlugin);
    plugins.unshift(compileModule(customPlugin));
  }

  // TODO: test
  plugins.unshift(function customPlugin2() {
    return {
      name: "mark-original-loc",
      visitor: {
        "ExpressionStatement|BinaryExpression|MemberExpression|Literal|Identifier"(
          path
        ) {
          if (!path.node.originalLoc) {
            path.node.originalLoc = {
              type: path.node.type,
              start: path.node.start,
              end: path.node.end,
            };
          }
        },
      },
    };
  });

  return {
    ast: true,
    parserOpts: {
      plugins: [
        "typescript",
        "jsx",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
      ],
    },
    babelrc: false,
    configFile: false,
    ...options,
    presets,
    plugins,
    // for each visitor, but not if code is untouched by babel (in this case that's bad?)
    wrapPluginVisitorMethod(pluginAlias, visitorType, callback) {
      return function (...args) {
        let node = args[0].node;
        if (!node.originalLoc && node.type === "NumericLiteral") {
          node.originalLoc = {
            type: node.type,
            start: node.start,
            end: node.end,
            originalValue: node.extra.raw,
          };
        }
        callback.call(this, ...args);
      };
    },
  };
}
