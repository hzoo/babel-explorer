import env from "@babel/preset-env";
import react from "@babel/preset-react";
import runtime from "@babel/plugin-transform-runtime";
import typescript from "@babel/preset-typescript";

export const plugins = {};
export const presets = {};
presets["@babel/preset-env"] = env;
presets["@babel/preset-react"] = react;
presets["@babel/preset-typescript"] = typescript;
plugins["@babel/plugin-transform-runtime"] = runtime;
