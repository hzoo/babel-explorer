// https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md
export const shadowMapFunctions = {
  ArrayExpression,
  AssignmentExpression,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  CatchClause,
  ConditionalExpression,
  ContinueStatement,
  ExpressionStatement,
  IfStatement,
  FunctionDeclaration,
  JSXAttribute,
  LabeledStatement,
  LogicalExpression,
  MemberExpression,
  MetaProperty,
  // NewExpression,
  ObjectExpression,
  ObjectProperty,
  SequenceExpression,
  SpreadElement,
  StringLiteral,
  SwitchCase,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
  RegExpLiteral,
  ReturnStatement,
  UnaryExpression,
  UpdateExpression,
  // WithStatement,
};

function buildLabelStatement(node, source, output, prefix) {
  // prefix (e.g. return)
  let shadowMap = [...Array(prefix.length)].map((_, i) => {
    return {
      main: node._sourceNode.start + i,
      shadow: node.start + i,
    };
  });

  // ;
  if (
    source[node._sourceNode.end - 1] === ";" &&
    output[node.end - 1] === ";"
  ) {
    shadowMap.push({ main: node._sourceNode.end - 1, shadow: node.end - 1 });
  }

  return {
    shadowMap,
  };
}

function BreakStatement(...args) {
  return buildLabelStatement(...args, "break");
}

function ContinueStatement(...args) {
  return buildLabelStatement(...args, "continue");
}

function ReturnStatement(...args) {
  return buildLabelStatement(...args, "return");
}

function ThrowStatement(...args) {
  return buildLabelStatement(...args, "throw");
}

// switch (expr) {}
// switch (a) { case 'a': a; case 'b': b; }
// TODO: account for parens (check node.extra.parenthesized)
function SwitchStatement(node, source, output) {
  // () {}
  let shadowMap = [
    {
      main:
        node._sourceNode.start +
        source
          .slice(node._sourceNode.start, node._sourceNode.discriminant.start)
          .indexOf("("),
      shadow:
        node.start +
        output.slice(node.start, node.discriminant.start).indexOf("("),
    },
    {
      main:
        node._sourceNode.discriminant.end +
        source
          .slice(
            node._sourceNode.discriminant.end,
            node._sourceNode.cases.length === 0
              ? node._sourceNode.end
              : node._sourceNode.cases[0].start
          )
          .indexOf(")"),
      shadow:
        node.discriminant.end +
        output
          .slice(
            node.discriminant.end,
            node.cases.length === 0 ? node.end : node.cases[0].start
          )
          .indexOf(")"),
    },
    {
      main:
        node._sourceNode.discriminant.end +
        source
          .slice(
            node._sourceNode.discriminant.end,
            node._sourceNode.cases.length === 0
              ? node._sourceNode.end
              : node._sourceNode.cases[0].start
          )
          .indexOf("{"),
      shadow:
        node.discriminant.end +
        output
          .slice(
            node.discriminant.end,
            node.cases.length === 0 ? node.end : node.cases[0].start
          )
          .indexOf("{"),
    },
    {
      main:
        node._sourceNode.cases.length === 0
          ? node._sourceNode.discriminant.end +
            source
              .slice(node._sourceNode.discriminant.end, node._sourceNode.end)
              .indexOf("}")
          : node._sourceNode.cases[node._sourceNode.cases.length - 1].end +
            source
              .slice(
                node._sourceNode.cases[node._sourceNode.cases.length - 1].end,
                node._sourceNode.end
              )
              .indexOf("}"),
      shadow:
        node.cases.length === 0
          ? node.discriminant.end +
            output.slice(node.discriminant.end, node.end).indexOf("}")
          : node.cases[node.cases.length - 1].end +
            output
              .slice(node.cases[node.cases.length - 1].end, node.end)
              .indexOf("}"),
    },
  ];

  // switch
  [...Array("switch".length)].forEach((_, i) => {
    shadowMap.push({
      main: node._sourceNode.start + i,
      shadow: node.start + i,
    });
  });

  return {
    shadowMap,
  };
}

// case 'a': a;
function SwitchCase(node, source, output) {
  let shadowMap = [];

  if (node.test) {
    // :
    shadowMap.push({
      main:
        node._sourceNode.test.end +
        source
          .slice(node._sourceNode.test.end, node._sourceNode.consequent.start)
          .indexOf(":"),
      shadow:
        node.test.end +
        output.slice(node.test.end, node.consequent.start).indexOf(":"),
    });
    // case
    [...Array("case".length)].forEach((_, i) => {
      shadowMap.push({
        main: node._sourceNode.start + i,
        shadow: node.start + i,
      });
    });
  } else {
    // default:
    [...Array("default".length)].forEach((_, i) => {
      shadowMap.push({
        main: node._sourceNode.start + i,
        shadow: node.start + i,
      });
    });
    // :
    shadowMap.push({
      main:
        node._sourceNode.start +
        source
          .slice(node._sourceNode.start, node._sourceNode.consequent.start)
          .indexOf(":"),
      shadow:
        node.start +
        output.slice(node.start, node.consequent.start).indexOf(":"),
    });
  }

  return {
    shadowMap,
  };
}

/*
interface TryStatement <: Statement {
  type: "TryStatement";
  block: BlockStatement;
  handler: CatchClause | null;
  finalizer: BlockStatement | null;
}
*/
function TryStatement(node, source, output) {
  let shadowMap = [];

  // try
  [...Array("try".length)].forEach((_, i) => {
    shadowMap.push({
      main: node._sourceNode.start + i,
      shadow: node.start + i,
    });
  });

  // finall
  if (node.finalizer) {
    let finalizerStart = node.handler ? "handler" : "block";
    [...Array("finally".length)].forEach((_, i) => {
      shadowMap.push({
        main:
          node._sourceNode[finalizerStart].end +
          source
            .slice(
              node._sourceNode[finalizerStart].end,
              node._sourceNode.finalizer.start
            )
            .indexOf("finally") +
          i,
        shadow:
          node[finalizerStart].end +
          output
            .slice(node[finalizerStart].end, node.finalizer.start)
            .indexOf("finally") +
          i,
      });
    });
  }

  return {
    shadowMap,
  };
}

/*
interface CatchClause <: Node {
  type: "CatchClause";
  param?: Pattern;
  body: BlockStatement;
}
*/
// TODO: Optional Catch Binding
function CatchClause(node, source, output) {
  let shadowMap = [];

  // catch
  [...Array("catch".length)].forEach((_, i) => {
    shadowMap.push({
      main: node._sourceNode.start + i,
      shadow: node.start + i,
    });
  });

  // ( )
  if (node.param) {
    shadowMap.push({
      main:
        node._sourceNode.param &&
        node._sourceNode.start +
          source
            .slice(node._sourceNode.start, node._sourceNode.param.start)
            .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.param.start).indexOf("("),
    });
    shadowMap.push({
      main:
        node._sourceNode.param &&
        node._sourceNode.param.end +
          source
            .slice(node._sourceNode.param.end, node._sourceNode.body.start)
            .indexOf(")"),
      shadow:
        node.param.end +
        output.slice(node.param.end, node.body.start).indexOf(")"),
    });
  }

  return {
    shadowMap,
  };
}

/*
interface Function <: Node {
  id: Identifier | null;
  params: [ Pattern ];
  body: BlockStatement;
  generator: boolean;
  async: boolean;
}*/
function FunctionDeclaration(node, source, output) {
  let shadowMap = [
    {
      main:
        node._sourceNode.params.length === 0
          ? node._sourceNode.id.end +
            source
              .slice(node._sourceNode.id.end, node._sourceNode.body.start)
              .indexOf("(")
          : node._sourceNode.id.end +
            source
              .slice(node._sourceNode.id.end, node._sourceNode.params[0].start)
              .indexOf("("),
      shadow:
        node.params.length === 0
          ? node.id.end +
            output.slice(node.id.end, node.body.start).indexOf("(")
          : node.id.end +
            output.slice(node.id.end, node.params[0].start).indexOf("("),
    },
    {
      main:
        node._sourceNode.params.length === 0
          ? node._sourceNode.id.end +
            source
              .slice(node._sourceNode.id.end, node._sourceNode.body.start)
              .indexOf(")")
          : node._sourceNode.params[node._sourceNode.params.length - 1].end +
            source
              .slice(
                node._sourceNode.params[node._sourceNode.params.length - 1].end,
                node._sourceNode.body.start
              )
              .indexOf(")"),
      shadow:
        node.params.length === 0
          ? node.id.end +
            output.slice(node.id.end, node.body.start).indexOf(")")
          : node.params[node.params.length - 1].end +
            output
              .slice(node.params[node.params.length - 1].end, node.body.start)
              .indexOf(")"),
    },
  ];

  node.params.forEach((param, i) => {
    if (i < node.params.length - 1) {
      shadowMap.push({
        main:
          node._sourceNode.params[i].end +
          source
            .slice(
              node._sourceNode.params[i].end,
              node._sourceNode.params[i + 1].start
            )
            .indexOf(","),
        shadow:
          node.params[i].end +
          output
            .slice(node.params[i].end, node.params[i + 1].start)
            .indexOf(","),
      });
    }
  });
  let last = node.params.length - 1;
  if (last > 0) {
    let mainTrailing = source
      .slice(node._sourceNode.params[last].end, node._sourceNode.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.params[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node._sourceNode.params[last].end
            : undefined,
        shadow: shadowTrailing + node.params[last].end,
      });
    }
  }
  if (node.async) {
    // function
    [...Array("async".length)].forEach((_, i) => {
      shadowMap.push({
        main: node._sourceNode.start + i,
        shadow: node.start + i,
      });
    });
    [...Array("function".length)].forEach((_, i) => {
      shadowMap.push({
        main:
          node._sourceNode.start +
          source
            .slice(node._sourceNode.start, node._sourceNode.id.start)
            .indexOf("function") +
          i,
        shadow:
          node.start +
          output.slice(node.start, node.id.start).indexOf("function") +
          i,
      });
    });
  } else {
    // function
    [...Array("function".length)].forEach((_, i) => {
      shadowMap.push({
        main: node._sourceNode.start + i,
        shadow: node.start + i,
      });
    });
  }

  return {
    shadowMap,
  };
}

// if (a) a; else if (b) b; else c;
function IfStatement(node, source, output) {
  let shadowMap = [
    // i
    {
      main: node._sourceNode.start,
      shadow: node.start,
    },
    // f
    {
      main: node._sourceNode.start + 1,
      shadow: node.start + 1,
    },
    // (
    {
      main:
        node._sourceNode.start +
        source
          .slice(node._sourceNode.start, node._sourceNode.test.start)
          .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.test.start).indexOf("("),
    },
    // )
    {
      main:
        node._sourceNode.test.end +
        source
          .slice(node._sourceNode.test.end, node._sourceNode.consequent.start)
          .indexOf(")"),
      shadow:
        node.test.end +
        output.slice(node.test.end, node.consequent.start).indexOf(")"),
    },
  ];

  // else
  if (node.alternate) {
    [...Array("else".length)].forEach((_, i) => {
      shadowMap.push({
        main:
          node._sourceNode.consequent.end +
          source
            .slice(
              node._sourceNode.consequent.end,
              node._sourceNode.alternate.start
            )
            .indexOf("else") +
          i,
        shadow:
          node.consequent.end +
          output
            .slice(node.consequent.end, node.alternate.start)
            .indexOf("else") +
          i,
      });
    });
  }

  return {
    shadowMap,
  };
}

// "'asdf'" -> "asdf" in ObjectProperty
function StringLiteral(node, source, output) {
  if (
    node._sourceNode &&
    source.slice(node._sourceNode.start + 1, node._sourceNode.end - 1) ===
      output.slice(node.start, node.end)
  ) {
    let transformMap = [
      {
        main: node._sourceNode.start,
        cMain: source[node._sourceNode.start],
        shadow: node.start,
        cShadow: "",
      },
      {
        main: node._sourceNode.end - 1,
        cMain: source[node._sourceNode.end - 1],
        shadow: node.end - 1,
        cShadow: "",
      },
    ];

    let shadowMap = [];
    for (let i = 1; i <= node._sourceNode.value.length; i++) {
      shadowMap.push({
        main: node._sourceNode.start + i,
        cMain: source[node._sourceNode.start + i],
        shadow: node.start + i - 1,
        cShadow: output[node.start + i - 1],
      });
    }

    return {
      transformMap,
      shadowMap,
    };
  }
}

function NewExpression(node, source, output) {
  // let shadowMap = CallExpression(node, source, output).shadowMap;

  [...Array("new".length)].forEach((_, i) => {
    shadowMap.push({
      main: node._sourceNode.start + i,
      shadow: node.start + i,
    });
  });

  return {
    shadowMap,
  };
}

// a(a,b,c)
function CallExpression(node, source, output) {
  let shadowMap = [
    {
      main:
        node._sourceNode.callee.end +
        source
          .slice(
            node._sourceNode.callee.end,
            node._sourceNode.arguments.length === 0
              ? node._sourceNode.end
              : node._sourceNode.arguments[0].start
          )
          .indexOf("("),
      shadow:
        node.callee.end +
        output
          .slice(
            node.callee.end,
            node.arguments.length === 0 ? node.end : node.arguments[0].start
          )
          .indexOf("("),
    },
    {
      main:
        node._sourceNode.arguments.length === 0
          ? node._sourceNode.callee.end +
            source
              .slice(node._sourceNode.callee.end, node._sourceNode.end)
              .indexOf(")")
          : node._sourceNode.arguments[node._sourceNode.arguments.length - 1]
              .end +
            source
              .slice(
                node._sourceNode.arguments[
                  node._sourceNode.arguments.length - 1
                ].end,
                node._sourceNode.end
              )
              .indexOf(")"),
      shadow:
        node.arguments.length === 0
          ? node.callee.end +
            output.slice(node.callee.end, node.end).indexOf(")")
          : node.arguments[node.arguments.length - 1].end +
            output
              .slice(node.arguments[node.arguments.length - 1].end, node.end)
              .indexOf(")"),
    },
  ];
  node.arguments.forEach((argument, i) => {
    if (i < node.arguments.length - 1) {
      shadowMap.push({
        main:
          node._sourceNode.arguments[i].end +
          source
            .slice(
              node._sourceNode.arguments[i].end,
              node._sourceNode.arguments[i + 1].start
            )
            .indexOf(","),
        shadow:
          node.arguments[i].end +
          output
            .slice(node.arguments[i].end, node.arguments[i + 1].start)
            .indexOf(","),
      });
    }
  });
  return { shadowMap };
}

// import.meta
function MetaProperty(node, source, output) {
  return {
    shadowMap: [
      {
        main:
          node._sourceNode.meta.end +
          source
            .slice(node._sourceNode.meta.end, node._sourceNode.property.start)
            .indexOf("."),
        shadow:
          node.meta.end +
          output.slice(node.meta.end, node.property.start).indexOf("."),
      },
    ],
  };
}

function LabeledStatement(node, source, output) {
  return {
    shadowMap: [
      {
        main:
          node._sourceNode.label.end +
          source
            .slice(node._sourceNode.label.end, node._sourceNode.body.start)
            .indexOf(":"),
        shadow:
          node.label.end +
          output.slice(node.label.end, node.body.start).indexOf(":"),
      },
    ],
  };
}

function SpreadElement(node, source, output) {
  let shadowMap = [...Array(3)].map((_, i) => {
    return {
      main: node._sourceNode.start + i,
      shadow: node.start + i,
    };
  });

  return {
    shadowMap,
  };
}

// TODO: new regex
// /./s;
// /./su;
// /o+/y;
// /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
function RegExpLiteral(node, source, output) {
  let shadowMap = [
    {
      main: node._sourceNode.start,
      shadow: node.start,
    },
    {
      main:
        node._sourceNode.start +
        source
          .slice(node._sourceNode.start, node._sourceNode.end)
          .lastIndexOf("/"),
      shadow: node.start + output.slice(node.start, node.end).lastIndexOf("/"),
    },
  ];

  if (node._sourceNode.pattern === node.pattern) {
    [...Array(node.pattern.length)].forEach((_, i) => {
      shadowMap.push({
        main: node._sourceNode.start + 1 + i,
        shadow: node.start + 1 + i,
      });
    });
  }

  if (node._sourceNode.flags === node.flags) {
    [...Array(node.flags.length)].forEach((_, i) => {
      shadowMap.push({
        main: node._sourceNode.end - 1 - i,
        shadow: node.end - 1 - i,
      });
    });
  }

  return {
    shadowMap,
  };
}

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
          source[node._sourceNode.end - 1] === ";" && node._sourceNode.end - 1,
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

// a ? b : c
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
        main: node._sourceNode.prefix
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
// a[b]
function MemberExpression(node, source, output) {
  if (!node.computed) {
    return {
      shadowMap: [
        {
          main:
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
  } else {
    return {
      shadowMap: [
        {
          main:
            node._sourceNode.object.end +
            source
              .slice(
                node._sourceNode.object.end,
                node._sourceNode.property.start
              )
              .indexOf("["),
          shadow:
            node.object.end +
            output.slice(node.object.end, node.property.start).indexOf("["),
        },
        {
          main:
            node._sourceNode.property.end +
            source
              .slice(node._sourceNode.property.end, node._sourceNode.end)
              .indexOf("]"),
          shadow:
            node.property.end +
            output.slice(node.property.end, node.end).indexOf("]"),
        },
      ],
    };
  }
}

function BinaryExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
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

function ObjectProperty(node, source, output) {
  let shadowMap = [
    {
      main:
        !node._sourceNode.shorthand &&
        node._sourceNode.key.end +
          source
            .slice(node._sourceNode.key.end, node._sourceNode.value.start)
            .indexOf(":"),
      shadow:
        !node.shorthand &&
        node.key.end +
          output.slice(node.key.end, node.value.start).indexOf(":"),
    },
  ];

  if (node.computed) {
    shadowMap.push({
      main: node._sourceNode.computed && node._sourceNode.start,
      shadow: node.start,
    });
    shadowMap.push({
      main:
        node._sourceNode.computed &&
        node._sourceNode.key.end +
          source
            .slice(node._sourceNode.key.end, node._sourceNode.value.start)
            .indexOf("]"),
      shadow:
        node.key.end +
        output.slice(node.key.end, node.value.start).indexOf("]"),
    });
  }

  return {
    shadowMap,
  };
}

function ObjectExpression(node, source, output) {
  let shadowMap = [
    { main: node._sourceNode.start, shadow: node.start },
    { main: node._sourceNode.end - 1, shadow: node.end - 1 },
  ];
  node.properties.forEach((element, i) => {
    if (i < node.properties.length - 1) {
      shadowMap.push({
        main:
          node._sourceNode.properties[i].end +
          source
            .slice(
              node._sourceNode.properties[i].end,
              node._sourceNode.properties[i + 1].key.start
            )
            .indexOf(","),
        shadow:
          node.properties[i].end +
          output
            .slice(node.properties[i].end, node.properties[i + 1].key.start)
            .indexOf(","),
      });
    }
  });
  let last = node.properties.length - 1;
  if (last > 0) {
    let mainTrailing = source
      .slice(node._sourceNode.properties[last].end, node._sourceNode.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.properties[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node._sourceNode.properties[last].end
            : undefined,
        shadow: shadowTrailing + node.properties[last].end,
      });
    }
  }
  return {
    shadowMap,
  };
}

function BlockStatement(node, source, output) {
  let shadowMap = [
    { main: node._sourceNode.start, shadow: node.start },
    { main: node._sourceNode.end - 1, shadow: node.end - 1 },
  ];
  return {
    shadowMap,
  };
}

function SequenceExpression(node, source, output) {
  let shadowMap = [];
  node.expressions.forEach((element, i) => {
    if (i < node._sourceNode.expressions.length - 1) {
      shadowMap.push({
        main:
          node._sourceNode.expressions[i].end +
          source
            .slice(
              node._sourceNode.expressions[i].end,
              node._sourceNode.expressions[i + 1].start
            )
            .indexOf(","),
        shadow:
          node.expressions[i].end +
          output
            .slice(node.expressions[i].end, node.expressions[i + 1].start)
            .indexOf(","),
      });
    }
  });
  return {
    shadowMap,
  };
}

function ArrayExpression(node, source, output) {
  let shadowMap = [
    { main: node._sourceNode.start, shadow: node.start }, //
    {
      main: node._sourceNode.end - 1,
      shadow: node.end - 1,
    },
  ];
  node.elements.forEach((element, i) => {
    if (i < node._sourceNode.elements.length - 1) {
      if (node._sourceNode.elements[i + 1] === null) {
        // TODO: sparse arrays
        throw new Error("TODO: doesn't handle sparse arrays [1,,2] yet");
      }
      shadowMap.push({
        main:
          node._sourceNode.elements[i].end +
          source
            .slice(
              node._sourceNode.elements[i].end,
              node._sourceNode.elements[i + 1].start
            )
            .indexOf(","),
        shadow:
          node.elements[i].end +
          output
            .slice(node.elements[i].end, node.elements[i + 1].start)
            .indexOf(","),
      });
    }
  });
  let last = node.elements.length - 1;
  if (last > 0) {
    let mainTrailing = source
      .slice(node._sourceNode.elements[last].end, node._sourceNode.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.elements[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node._sourceNode.elements[last].end
            : undefined,
        shadow: shadowTrailing + node.elements[last].end,
      });
    }
  }
  return {
    shadowMap,
  };
}

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
  let fn = shadowMapFunctions[node.type];
  if (fn && node._sourceNode.type === node.type) {
    return fn(node, source, output);
  }

  if (!node._sourceNode) return -1;

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
      node.type === "BooleanLiteral" ||
      node.type === "NullLiteral" ||
      node.type === "NumericLiteral" ||
      node.type === "BigIntLiteral" ||
      node.type === "DecimalLiteral" ||
      node.type === "DebuggerStatement" ||
      node.type === "Directive" ||
      node.type === "Import" ||
      node.type === "ThisExpression" ||
      node.type === "EmptyStatement")
  ) {
    return;
  } else {
    console.error(
      `unsupported! original: ${node._sourceNode.type}, type: ${node.type}`
    );
    return -1;
  }
}
