import env from "@babel/preset-env";
import react from "@babel/preset-react";
import runtime from "@babel/plugin-transform-runtime";

export const plugins = {};
export const presets = {};
presets["@babel/preset-env"] = env;
presets["@babel/preset-react"] = react;
plugins["@babel/plugin-transform-runtime"] = runtime;
