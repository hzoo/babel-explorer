import React from "react";
import JSONTree from "react-json-tree";

function formatNode(data) {
  if (data.type === "Identifier") {
    return <span>{`${data.type} (${data.name})`}</span>;
  } else if (data.type === "StringLiteral") {
    return <span>{`${data.type} (${data.value})`}</span>;
  } else if (data.type === "TemplateElement") {
    return <span>{`${data.type} (${data.value.cooked})`}</span>;
  } else if (data.type === "BooleanLiteral") {
    return <span>{`${data.type} (${data.value})`}</span>;
  } else if (data.type === "RegExpLiteral") {
    return <span>{`${data.type} (${data.pattern})`}</span>;
  }
  return <span>{`${data.type}`}</span>;
}

let autoExpand = {
  root: true,
  program: true,
  body: true,
};

export default function AST({ ast }) {
  return (
    <JSONTree
      data={JSON.parse(JSON.stringify(ast))}
      theme={{
        valueLabel: {
          textDecoration: "underline",
        },
      }}
      postprocessValue={value => {
        // hide start/end?
        if (value?.type) {
          if (typeof value.start === "number") delete value.start;
          if (typeof value.end === "number") delete value.end;
        }
        return value;
      }}
      nestedNodeLabel={({ style }, keyPath, nodeType, expanded) => ({
        style: {
          ...style,
          textTransform: expanded ? "uppercase" : style.textTransform,
        },
      })}
      shouldExpandNode={(keyPath, data, level) => {
        return autoExpand[keyPath[0]];
      }}
      getItemString={(type, data, itemType, itemString) => {
        if (data.type) {
          return formatNode(data);
        } else if (data.start) {
          return (
            <span>
              {`${data.start.line}:${data.start.column}, ${data.end.line}:${data.end.column}`}
            </span>
          );
        } else if (data.line) {
          return <span>{`${data.line}:${data.column}`}</span>;
        }

        return (
          <span>
            {itemType} {itemString}
          </span>
        );
      }}
    />
  );
}
