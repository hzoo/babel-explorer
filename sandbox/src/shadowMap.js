// take the ; from a;
function ExpressionStatement(node, source, output) {
  return {
    // mainStart: node._sourceNode.end - 1,
    // mainEnd: node._sourceNode.end,
    // shadowStart: node.end - 1,
    // shadowEnd: node.end,
    shadowMap: [
      {
        main:
          node?._sourceNode?.type === "ExpressionStatement" &&
          source[node._sourceNode.end - 1] === ";" &&
          node._sourceNode.end - 1,
        shadow: output[node.end - 1] === ";" && node.end - 1,
      },
    ],
  };
}

function JSXAttribute(node, source, output) {
  return {
    shadowMap: [
      {
        main:
          node._sourceNode.name.end +
          source
            .slice(node._sourceNode.name.end, node._sourceNode.value.start)
            .indexOf("="),
        shadow:
          node.key.end +
          output.slice(node.key.end, node.value.start).indexOf("="),
      },
    ],
  };
}

function ConditionalExpression(node, source, output) {
  return {
    shadowMap: [
      {
        main:
          node._sourceNode.test.end +
          source
            .slice(node._sourceNode.test.end, node._sourceNode.consequent.start)
            .indexOf("?"),
        shadow:
          node.test.end +
          output.slice(node.test.end, node.consequent.start).indexOf("?"),
      },
      {
        main:
          node._sourceNode.consequent.end +
          source
            .slice(
              node._sourceNode.consequent.end,
              node._sourceNode.alternate.start
            )
            .indexOf(":"),
        shadow:
          node.consequent.end +
          output.slice(node.consequent.end, node.alternate.start).indexOf(":"),
      },
    ],
  };
}

function UnaryExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
          node?._sourceNode?.type === "UnaryExpression" &&
          node._sourceNode.start +
            source
              .slice(node._sourceNode.start, node._sourceNode.argument.start)
              .indexOf(node._sourceNode.operator) +
            i,
        shadow:
          node.start +
          output.slice(node.start, node.argument.start).indexOf(node.operator) +
          i,
      };
    }),
  };
}
function UpdateExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
          node?._sourceNode?.type === "UpdateExpression" &&
          node._sourceNode.prefix
            ? node._sourceNode.start +
              source
                .slice(node._sourceNode.start, node._sourceNode.argument.start)
                .indexOf(node._sourceNode.operator) +
              i
            : node._sourceNode.argument.end +
              source
                .slice(node._sourceNode.argument.end, node._sourceNode.end)
                .indexOf(node._sourceNode.operator) +
              i,
        shadow: node._sourceNode.prefix
          ? node.start +
            output
              .slice(node.start, node.argument.start)
              .indexOf(node.operator) +
            i
          : node.argument.end +
            output.slice(node.argument.end, node.end).indexOf(node.operator) +
            i,
      };
    }),
  };
}

// a.b
// TODO: a[b]
function MemberExpression(node, source, output) {
  return {
    shadowMap: [
      {
        main:
          node?._sourceNode?.type === "MemberExpression" &&
          node._sourceNode.object.end +
            source
              .slice(
                node._sourceNode.object.end,
                node._sourceNode.property.start
              )
              .indexOf("."),
        shadow:
          node.object.end +
          output.slice(node.object.end, node.property.start).indexOf("."),
      },
    ],
  };
}

function BinaryExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
          node?._sourceNode?.type === "BinaryExpression" &&
          node._sourceNode.left.end +
            source
              .slice(node._sourceNode.left.end, node._sourceNode.right.start)
              .indexOf(node._sourceNode.operator) +
            i,
        shadow:
          node.left.end +
          output.slice(node.left.end, node.right.start).indexOf(node.operator) +
          i,
      };
    }),
  };
}

function LogicalExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
          node?._sourceNode?.type === "LogicalExpression" &&
          node._sourceNode.left.end +
            source
              .slice(node._sourceNode.left.end, node._sourceNode.right.start)
              .indexOf(node._sourceNode.operator) +
            i,
        shadow:
          node.left.end +
          output.slice(node.left.end, node.right.start).indexOf(node.operator) +
          i,
      };
    }),
  };
}

// TODO:
// x **= y;
// x &&= y;
// x ||= y;
// x ??= y;
function AssignmentExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
          node?._sourceNode?.type === "AssignmentExpression" &&
          node._sourceNode.left.end +
            source
              .slice(node._sourceNode.left.end, node._sourceNode.right.start)
              .indexOf(node._sourceNode.operator) +
            i,
        shadow:
          node.left.end +
          output.slice(node.left.end, node.right.start).indexOf(node.operator) +
          i,
      };
    }),
  };
}

function ObjectExpression(node, source, output) {
  let shadowMap = [
    { main: node?._sourceNode?.start, shadow: node.start },
    { main: node?._sourceNode?.end - 1, shadow: node.end - 1 },
  ];
  node.properties.forEach((element, i) => {
    shadowMap.push({
      main:
        node?._sourceNode?.properties[i].key.end +
        source
          .slice(
            node?._sourceNode?.properties[i].key.end,
            node?._sourceNode?.properties[i].value.start
          )
          .indexOf(":"),
      shadow:
        node.properties[i].key.end +
        output
          .slice(node.properties[i].key.end, node.properties[i].value.start)
          .indexOf(":"),
    });
    if (i < node.properties.length - 1) {
      shadowMap.push({
        main:
          node?._sourceNode?.properties[i].value.end +
          source
            .slice(
              node?._sourceNode?.properties[i].value.end,
              node?._sourceNode?.properties[i + 1].key.start
            )
            .indexOf(","),
        shadow:
          node.properties[i].value.end +
          output
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
}

function BlockStatement(node, source, output) {
  let shadowMap = [
    { main: node?._sourceNode?.start, shadow: node.start },
    { main: node?._sourceNode?.end - 1, shadow: node.end - 1 },
  ];
  return {
    shadowMap,
  };
}

function ArrayExpression(node, source, output) {
  let shadowMap = [
    { main: node?._sourceNode?.start, shadow: node.start },
    {
      main: node?._sourceNode?.end - 1,
      shadow: node.end - 1,
    },
  ];
  node.elements.forEach((element, i) => {
    if (i < node?._sourceNode?.elements.length - 1) {
      if (node?._sourceNode?.elements[i + 1] === null) {
        // TODO: sparse arrays
        throw new Error("TODO: doesn't handle sparse arrays [1,,2] yet");
      }
      shadowMap.push({
        main:
          node?._sourceNode?.elements[i].end +
          source
            .slice(
              node?._sourceNode?.elements[i].end,
              node?._sourceNode?.elements[i + 1]?.start
            )
            .indexOf(","),
        shadow:
          node.elements[i].end +
          output
            .slice(node.elements[i].end, node.elements[i + 1]?.start)
            .indexOf(","),
      });
    }
  });
  // TODO: account for trailing comma? bug with .extra not reset?
  // if (
  //   node?.extra?.trailingComma ||
  //   node?._sourceNode?.extra?.trailingComma
  // ) {
  //   shadowMap.push({
  //     main: node?._sourceNode?.extra?.trailingComma,
  //     shadow: node?.extra?.trailingComma,
  //   });
  // }
  return {
    shadowMap,
  };
}

let mapFunctions = {
  ArrayExpression,
  AssignmentExpression,
  BinaryExpression,
  BlockStatement,
  ConditionalExpression,
  ExpressionStatement,
  JSXAttribute,
  LogicalExpression,
  MemberExpression,
  ObjectExpression,
  UnaryExpression,
  UpdateExpression,
};

// 1_000 to 1000
function NumericSeparator_to_NumericLiteral(node) {
  let shadowMap = [];

  let index = -1;
  let original = node._sourceNode.extra.raw;
  [...Array(original.length)].forEach((_, i) => {
    if (original[i] !== "_") {
      index++;
      shadowMap.push({
        main: node._sourceNode.start + i,
        shadow: node.start + index,
      });
    }
  });
  return { shadowMap };
}

// <a b="1"></a> -> _jsx("a", {b: "1"})
function JSXAttribute_to_ObjectProperty(node, source, output) {
  return {
    transformMap: [
      {
        main:
          node._sourceNode.name.end +
          source
            .slice(node._sourceNode.name.end, node._sourceNode.value.start)
            .indexOf("="),
        shadow:
          node.key.end +
          output.slice(node.key.end, node.value.start).indexOf(":"),
        cMain: "=",
        cShadow: ":",
      },
    ],
  };
}

// <asdf> to asdf
function JSXIdentifier_to_StringLiteral(node) {
  return {
    shadowMap: [
      ...Array(node._sourceNode.end - node._sourceNode.start).keys(),
    ].map(i => ({
      main: node._sourceNode.start + i,
      shadow: node.start + 1 + i,
    })),
  };
}

export default function makeShadowMap(node, source, output) {
  if (!node.type) return;

  let fn = mapFunctions[node.type];
  if (fn) {
    return fn(node, source, output);
  }

  if (
    node.type === "NumericLiteral" &&
    node?._sourceNode?.extra?.raw?.includes("_")
  ) {
    return NumericSeparator_to_NumericLiteral(node);
  } else if (
    node._sourceNode.type === "JSXAttribute" &&
    node.type === "ObjectProperty"
  ) {
    return JSXAttribute_to_ObjectProperty(node, source, output);
  } else if (
    node._sourceNode.type === "JSXIdentifier" &&
    node.type === "StringLiteral"
  ) {
    return JSXIdentifier_to_StringLiteral(node);
  } else if (
    node._sourceNode.type === "JSXText" &&
    node.type === "StringLiteral"
  ) {
    let newStart = node.start + 1;
    let newEnd = node.end - 1;
    return {
      shadowStart: newStart,
      shadowEnd: newEnd,
      shadowMap: [
        ...Array(node._sourceNode.end - node._sourceNode.start).keys(),
      ].map(main => ({
        main: main + node._sourceNode.start,
        shadow: main + newStart,
      })),
    };
  } else if (node._sourceNode.type === "VariableDeclaration") {
    let shadowMap = [];
    let transformMap = [];

    // const -> let/var
    node._sourceNode.kind.split("").forEach((main, i) => {
      // if (i < node.kind.length) {
      let inc = Math.min(node.kind.length - 1, i);
      transformMap.push({
        main: node._sourceNode.start + i,
        cMain: main,
        shadow: node.start + inc,
        cShadow: node.kind[i] || "",
      });
      // }
    });

    // var a = 1, b = 2
    // get the = and ,
    let oDeclarations = node?._sourceNode?.declarations;
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
              output
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
              output
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
      source[node._sourceNode.end - 1] === ";" &&
      output[node.end - 1] === ";"
    ) {
      shadowMap.push({ main: node._sourceNode.end - 1, shadow: node.end - 1 });
    }
    return {
      shadowMap,
      transformMap,
    };
  } else if (
    // same type
    // preventing something like unhandled node (ObjectPattern -> Identifier)
    node.type === node._sourceNode.type &&
    (node.type === "Identifier" ||
      node.type === "StringLiteral" ||
      node.type === "BooleanLiteral" ||
      node.type === "NullLiteral" ||
      node.type === "NumericLiteral")
  ) {
    return;
  } else {
    console.error(
      `unsupported! original: ${node._sourceNode.type}, type: ${node.type}`
    );
    return -1;
  }
}
