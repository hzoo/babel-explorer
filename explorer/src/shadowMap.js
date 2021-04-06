// https://github.com/babel/babel/blob/main/packages/babel-parser/ast/spec.md
export const shadowMapFunctions = {
  ArrayExpression,
  ArrayPattern,
  // ArrowFunctionExpression,
  AssignmentPattern,
  AwaitExpression,
  AssignmentExpression,
  BinaryExpression,
  BindExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  CatchClause,
  ConditionalExpression,
  ContinueStatement,
  // Decorator,
  DoExpression,
  DoWhileStatement,
  ExpressionStatement,
  IfStatement,
  ImportDeclaration,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  ForStatement,
  ForInStatement,
  ForOfStatement,
  IfStatement,
  FunctionDeclaration,
  FunctionExpression,
  JSXAttribute,
  LabeledStatement,
  LogicalExpression,
  MemberExpression,
  MetaProperty,
  // ModuleExpression,
  NewExpression,
  ObjectExpression,
  ObjectMethod,
  ObjectPattern,
  ObjectProperty,
  OptionalCallExpression,
  OptionalMemberExpression,
  // ParenthesizedExpression,
  // RecordExpression,
  RestElement,
  SequenceExpression,
  SpreadElement,
  StringLiteral,
  SwitchCase,
  SwitchStatement,
  TemplateLiteral,
  ThrowStatement,
  // TupleExpression,
  TryStatement,
  RegExpLiteral,
  ReturnStatement,
  UnaryExpression,
  UpdateExpression,
  WhileStatement,
  WithStatement,
  YieldExpression,
};

// import "foo";
function ImportDeclaration(node, source, output) {
  // import
  let shadowMap = [...Array(6)].map((_, i) => {
    return {
      main: node.original.start + i,
      shadow: node.start + i,
    };
  });

  if (node.specifiers.length > 0) {
    node.specifiers.forEach((_, i) => {
      if (i < node.specifiers.length - 1) {
        shadowMap.push({
          main:
            node.original.specifiers[i].end +
            source
              .slice(node.original.specifiers[i].end, node.original.end)
              .indexOf(","),
          shadow:
            node.specifiers[i].end +
            output.slice(node.specifiers[i].end, node.end).indexOf(","),
        });
      }
    });

    [...Array(4)].forEach((_, i) => {
      shadowMap.push({
        main:
          node.original.start +
          source.slice(node.original.start, node.original.end).indexOf("from") +
          i,
        shadow:
          node.start + output.slice(node.start, node.end).indexOf("from") + i,
      });
    });

    let hasBrace = source
      .slice(node.original.start, node.original.end)
      .indexOf("{");

    if (hasBrace) {
      shadowMap.push({
        main:
          node.original.start +
          source.slice(node.original.start, node.original.end).indexOf("{"),
        shadow: node.start + output.slice(node.start, node.end).indexOf("{"),
      });

      shadowMap.push({
        main:
          node.original.start +
          source.slice(node.original.start, node.original.end).indexOf("}"),
        shadow: node.start + output.slice(node.start, node.end).indexOf("}"),
      });
    }
  }

  // ;
  if (source[node.original.end - 1] === ";" && output[node.end - 1] === ";") {
    shadowMap.push({ main: node.original.end - 1, shadow: node.end - 1 });
  }

  return {
    shadowMap,
  };
}

// import { bar as baz2 } from "foo";
function ImportNamespaceSpecifier(node, source, output) {
  return {
    shadowMap: [
      {
        main:
          node.original.start +
          source.slice(node.original.start, node.original.end).indexOf("*"),
        shadow: node.start + output.slice(node.start, node.end).indexOf("*"),
      },
      {
        main:
          node.original.start +
          source.slice(node.original.start, node.original.end).indexOf("as"),
        shadow: node.start + output.slice(node.start, node.end).indexOf("as"),
      },
      {
        main:
          node.original.start +
          source.slice(node.original.start, node.original.end).indexOf("as") +
          1,
        shadow:
          node.start + output.slice(node.start, node.end).indexOf("as") + 1,
      },
    ],
  };
}

// import { bar as baz2 } from "foo";
function ImportSpecifier(node, source, output) {
  if (node.imported.name === node.local.name) {
    return {
      shadowMap: [...Array(2)].map((_, i) => {
        return {
          main:
            node.original.start +
            source.slice(node.original.start, node.original.end).indexOf("as") +
            i,
          shadow:
            node.start + output.slice(node.start, node.end).indexOf("as") + i,
        };
      }),
    };
  }
}

// for (;;) {}
// for (var i = 0;;) {}
// for (var i = 0; i < 5;) {}
// for (var i = 0; i < 5; i++) {}
function ForStatement(node, source, output) {
  let rightMostProp = node =>
    node.update
      ? node.update.end
      : node.test
      ? node.test.end
      : node.init
      ? node.init.end
      : node.start;

  let shadowMap = [
    // f
    {
      main: node.original.start,
      shadow: node.start,
    },
    // o
    {
      main: node.original.start + 1,
      shadow: node.start + 1,
    },
    // r
    {
      main: node.original.start + 2,
      shadow: node.start + 2,
    },
    // (
    {
      main:
        node.original.start +
        source
          .slice(
            node.original.start,
            node.original[node.init ? "init" : "body"].start
          )
          .indexOf("("),
      shadow:
        node.start +
        output
          .slice(node.start, node[node.init ? "init" : "body"].start)
          .indexOf("("),
    },
    // )
    {
      main:
        rightMostProp(node.original) +
        source
          .slice(rightMostProp(node.original), node.original.body.start)
          .indexOf(")"),
      shadow:
        rightMostProp(node) +
        output.slice(rightMostProp(node), node.body.start).indexOf(")"),
    },
    // first ;
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.body.start)
          .indexOf(";"),
      shadow:
        node.start + output.slice(node.start, node.body.start).indexOf(";"),
    },
    // second ;
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.body.start)
          .lastIndexOf(";"),
      shadow:
        node.start + output.slice(node.start, node.body.start).lastIndexOf(";"),
    },
  ];

  return {
    shadowMap,
  };
}

// for (var i in []) {}
function ForInStatement(node, source, output) {
  let shadowMap = [
    // f
    {
      main: node.original.start,
      shadow: node.start,
    },
    // o
    {
      main: node.original.start + 1,
      shadow: node.start + 1,
    },
    // r
    {
      main: node.original.start + 2,
      shadow: node.start + 2,
    },
    // (
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.left.start)
          .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.left.start).indexOf("("),
    },
    // )
    {
      main:
        node.original.right.end +
        source
          .slice(node.original.right.end, node.original.body.start)
          .indexOf(")"),
      shadow:
        node.right.end +
        output.slice(node.right.end, node.body.start).indexOf(")"),
    },
  ];

  let inSource =
    node.original.left.end +
    source
      .slice(node.original.left.end, node.original.right.start)
      .indexOf("in");
  let inOutput =
    node.left.end + output.slice(node.left.end, node.right.start).indexOf("in");

  for (let i = 0; i < 2; i++) {
    shadowMap.push({
      main: inSource + i,
      shadow: inOutput + i,
    });
  }

  return {
    shadowMap,
  };
}

// for (var x of []) {}
// async () => {
//   for await (const a of []) {}
// };
function ForOfStatement(node, source, output) {
  let shadowMap = [
    // f
    {
      main: node.original.start,
      shadow: node.start,
    },
    // o
    {
      main: node.original.start + 1,
      shadow: node.start + 1,
    },
    // r
    {
      main: node.original.start + 2,
      shadow: node.start + 2,
    },
    // (
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.left.start)
          .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.left.start).indexOf("("),
    },
    // )
    {
      main:
        node.original.right.end +
        source
          .slice(node.original.right.end, node.original.body.start)
          .indexOf(")"),
      shadow:
        node.right.end +
        output.slice(node.right.end, node.body.start).indexOf(")"),
    },
  ];

  let awaitSource =
    node.original.start +
    source
      .slice(node.original.start, node.original.left.start)
      .indexOf("await");
  let awaitOutput =
    node.start + output.slice(node.start, node.left.start).indexOf("await");

  for (let i = 0; i < 5; i++) {
    shadowMap.push({
      main: awaitSource + i,
      shadow: awaitOutput + i,
    });
  }

  let ofSource =
    node.original.left.end +
    source
      .slice(node.original.left.end, node.original.right.start)
      .indexOf("of");
  let ofOutput =
    node.left.end + output.slice(node.left.end, node.right.start).indexOf("of");

  for (let i = 0; i < 2; i++) {
    shadowMap.push({
      main: ofSource + i,
      shadow: ofOutput + i,
    });
  }

  return {
    shadowMap,
  };
}

// while (a) {}
function WhileStatement(node, source, output) {
  let shadowMap = [...Array(5)].map((_, i) => {
    return {
      main: node.original.start + i,
      shadow: node.start + i,
    };
  });

  shadowMap.push(
    // (
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.test.start)
          .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.test.start).indexOf("("),
    },
    // )
    {
      main:
        node.original.test.end +
        source
          .slice(node.original.test.end, node.original.body.start)
          .indexOf(")"),
      shadow:
        node.test.end +
        output.slice(node.test.end, node.body.start).indexOf(")"),
    }
  );

  return {
    shadowMap,
  };
}

// with (a) {}
function WithStatement(node, source, output) {
  let shadowMap = [...Array(4)].map((_, i) => {
    return {
      main: node.original.start + i,
      shadow: node.start + i,
    };
  });

  shadowMap.push(
    // (
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.object.start)
          .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.object.start).indexOf("("),
    },
    // )
    {
      main:
        node.original.object.end +
        source
          .slice(node.original.object.end, node.original.body.start)
          .indexOf(")"),
      shadow:
        node.object.end +
        output.slice(node.object.end, node.body.start).indexOf(")"),
    }
  );

  return {
    shadowMap,
  };
}

// do {} while (a);
function DoWhileStatement(node, source, output) {
  let shadowMap = [
    // d
    {
      main: node.original.start,
      shadow: node.start,
    },
    // o
    {
      main: node.original.start + 1,
      shadow: node.start + 1,
    },
    // (
    {
      main:
        node.original.body.end +
        source
          .slice(node.original.body.end, node.original.test.start)
          .indexOf("("),
      shadow:
        node.body.end +
        output.slice(node.body.end, node.test.start).indexOf("("),
    },
    // )
    {
      main:
        node.original.test.end +
        source.slice(node.original.test.end, node.original.end).indexOf(")"),
      shadow:
        node.test.end + output.slice(node.test.end, node.end).indexOf(")"),
    },
  ];

  let whileSource =
    node.original.body.end +
    source
      .slice(node.original.body.end, node.original.test.start)
      .indexOf("while");
  let whileOutput =
    node.body.end +
    output.slice(node.body.end, node.test.start).indexOf("while");

  for (let i = 0; i < 5; i++) {
    shadowMap.push({
      main: whileSource + i,
      shadow: whileOutput + i,
    });
  }

  // ;
  if (source[node.original.end - 1] === ";" && output[node.end - 1] === ";") {
    shadowMap.push({ main: node.original.end - 1, shadow: node.end - 1 });
  }

  return {
    shadowMap,
  };
}

function buildLabelStatement(node, source, output, prefix) {
  // prefix (e.g. return)
  let shadowMap = [...Array(prefix.length)].map((_, i) => {
    return {
      main: node.original.start + i,
      shadow: node.start + i,
    };
  });

  // ;
  if (source[node.original.end - 1] === ";" && output[node.end - 1] === ";") {
    shadowMap.push({ main: node.original.end - 1, shadow: node.end - 1 });
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
function SwitchStatement(node, source, output) {
  // () {}
  let shadowMap = [
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.discriminant.start)
          .indexOf("("),
      shadow:
        node.start +
        output.slice(node.start, node.discriminant.start).indexOf("("),
    },
    {
      main:
        node.original.discriminant.end +
        source
          .slice(
            node.original.discriminant.end,
            node.original.cases.length === 0
              ? node.original.end
              : node.original.cases[0].start
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
        node.original.discriminant.end +
        source
          .slice(
            node.original.discriminant.end,
            node.original.cases.length === 0
              ? node.original.end
              : node.original.cases[0].start
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
        node.original.cases.length === 0
          ? node.original.discriminant.end +
            source
              .slice(node.original.discriminant.end, node.original.end)
              .indexOf("}")
          : node.original.cases[node.original.cases.length - 1].end +
            source
              .slice(
                node.original.cases[node.original.cases.length - 1].end,
                node.original.end
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
      main: node.original.start + i,
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
        node.original.test.end +
        source
          .slice(node.original.test.end, node.original.consequent.start)
          .indexOf(":"),
      shadow:
        node.test.end +
        output.slice(node.test.end, node.consequent.start).indexOf(":"),
    });
    // case
    [...Array("case".length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
  } else {
    // default:
    [...Array("default".length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
    // :
    shadowMap.push({
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.consequent.start)
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
      main: node.original.start + i,
      shadow: node.start + i,
    });
  });

  // finall
  if (node.finalizer) {
    let finalizerStart = node.handler ? "handler" : "block";
    [...Array("finally".length)].forEach((_, i) => {
      shadowMap.push({
        main:
          node.original[finalizerStart].end +
          source
            .slice(
              node.original[finalizerStart].end,
              node.original.finalizer.start
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

// try {} catch {}
// try {} catch (e) {}
function CatchClause(node, source, output) {
  let shadowMap = [];

  // catch
  [...Array("catch".length)].forEach((_, i) => {
    shadowMap.push({
      main: node.original.start + i,
      shadow: node.start + i,
    });
  });

  // ( )
  if (node.param) {
    shadowMap.push({
      main:
        node.original.param &&
        node.original.start +
          source
            .slice(node.original.start, node.original.param.start)
            .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.param.start).indexOf("("),
    });
    shadowMap.push({
      main:
        node.original.param &&
        node.original.param.end +
          source
            .slice(node.original.param.end, node.original.body.start)
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
        node.original.params.length === 0
          ? node.original.id.end +
            source
              .slice(node.original.id.end, node.original.body.start)
              .indexOf("(")
          : node.original.id.end +
            source
              .slice(node.original.id.end, node.original.params[0].start)
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
        node.original.params.length === 0
          ? node.original.id.end +
            source
              .slice(node.original.id.end, node.original.body.start)
              .indexOf(")")
          : node.original.params[node.original.params.length - 1].end +
            source
              .slice(
                node.original.params[node.original.params.length - 1].end,
                node.original.body.start
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
          node.original.params[i].end +
          source
            .slice(
              node.original.params[i].end,
              node.original.params[i + 1].start
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
      .slice(node.original.params[last].end, node.original.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.params[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node.original.params[last].end
            : undefined,
        shadow: shadowTrailing + node.params[last].end,
      });
    }
  }
  if (node.async) {
    // function
    [...Array("async".length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
    [...Array("function".length)].forEach((_, i) => {
      shadowMap.push({
        main:
          node.original.start +
          source
            .slice(node.original.start, node.original.id.start)
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
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
  }

  // *
  if (node.generator) {
    shadowMap.push({
      main:
        node.original.start +
        source.slice(node.original.start, node.original.id.start).indexOf("*"),
      shadow: node.start + output.slice(node.start, node.id.start).indexOf("*"),
    });
  }

  return {
    shadowMap,
  };
}

// var foo7 = function* foo7() {};
// var foo8 = function foo8() {};
// var foo9 = async function foo9() {};
// var foo10 = function* () {};
// var foo11 = function () {};
// var foo12 = async function () {};
function FunctionExpression(node, source, output) {
  let nodeOrId = node => (node.id ? node.id.end : node.start);

  let parensMain =
    node.original.params.length === 0
      ? nodeOrId(node.original) +
        source
          .slice(nodeOrId(node.original), node.original.body.start)
          .indexOf("(")
      : nodeOrId(node.original) +
        source
          .slice(nodeOrId(node.original), node.original.params[0].start)
          .indexOf("(");

  let parensShadow =
    node.params.length === 0
      ? nodeOrId(node) +
        output.slice(nodeOrId(node), node.body.start).indexOf("(")
      : nodeOrId(node) +
        output.slice(nodeOrId(node), node.params[0].start).indexOf("(");

  let shadowMap = [
    {
      main: parensMain,
      shadow: parensShadow,
    },
    {
      main:
        node.original.params.length === 0
          ? nodeOrId(node.original) +
            source
              .slice(nodeOrId(node.original), node.original.body.start)
              .indexOf(")")
          : node.original.params[node.original.params.length - 1].end +
            source
              .slice(
                node.original.params[node.original.params.length - 1].end,
                node.original.body.start
              )
              .indexOf(")"),
      shadow:
        node.params.length === 0
          ? nodeOrId(node) +
            output.slice(nodeOrId(node), node.body.start).indexOf(")")
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
          node.original.params[i].end +
          source
            .slice(
              node.original.params[i].end,
              node.original.params[i + 1].start
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
      .slice(node.original.params[last].end, node.original.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.params[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node.original.params[last].end
            : undefined,
        shadow: shadowTrailing + node.params[last].end,
      });
    }
  }
  if (node.async) {
    // function
    [...Array("async".length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
    [...Array("function".length)].forEach((_, i) => {
      shadowMap.push({
        main:
          node.original.start +
          source.slice(node.original.start, parensMain).indexOf("function") +
          i,
        shadow:
          node.start +
          output.slice(node.start, parensShadow).indexOf("function") +
          i,
      });
    });
  } else {
    // function
    [...Array("function".length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
  }

  // *
  if (node.generator) {
    shadowMap.push({
      main:
        node.original.start +
        source.slice(node.original.start, parensMain).indexOf("*"),
      shadow: node.start + output.slice(node.start, parensShadow).indexOf("*"),
    });
  }

  return {
    shadowMap,
  };
}

// a() {},
// async*[b]() {},
// get a() {},
// set a(a) {}
function ObjectMethod(node, source, output) {
  let parensMain =
    node.original.params.length === 0
      ? node.original.key.end +
        source
          .slice(node.original.key.end, node.original.body.start)
          .indexOf("(")
      : node.original.key.end +
        source
          .slice(node.original.key.end, node.original.params[0].start)
          .indexOf("(");

  let parensShadow =
    node.params.length === 0
      ? node.key.end + output.slice(node.key.end, node.body.start).indexOf("(")
      : node.key.end +
        output.slice(node.key.end, node.params[0].start).indexOf("(");

  let shadowMap = [
    {
      main: parensMain,
      shadow: parensShadow,
    },
    {
      main:
        node.original.params.length === 0
          ? node.original.key.end +
            source
              .slice(node.original.key.end, node.original.body.start)
              .indexOf(")")
          : node.original.params[node.original.params.length - 1].end +
            source
              .slice(
                node.original.params[node.original.params.length - 1].end,
                node.original.body.start
              )
              .indexOf(")"),
      shadow:
        node.params.length === 0
          ? node.key.end +
            output.slice(node.key.end, node.body.start).indexOf(")")
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
          node.original.params[i].end +
          source
            .slice(
              node.original.params[i].end,
              node.original.params[i + 1].start
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
      .slice(node.original.params[last].end, node.original.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.params[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node.original.params[last].end
            : undefined,
        shadow: shadowTrailing + node.params[last].end,
      });
    }
  }

  if (node.async) {
    // async
    [...Array("async".length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
  } else if (node.kind === "get" || node.kind === "set") {
    // get or set
    [...Array(3)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + i,
        shadow: node.start + i,
      });
    });
  }

  // *
  if (node.generator) {
    shadowMap.push({
      main:
        node.original.start +
        source.slice(node.original.start, node.original.key.start).indexOf("*"),
      shadow:
        node.start + output.slice(node.start, node.key.start).indexOf("*"),
    });
  }

  if (node.computed) {
    shadowMap.push({
      main:
        node.original.start +
        source.slice(node.original.start, node.original.key.start).indexOf("["),
      shadow:
        node.start + output.slice(node.start, node.key.start).indexOf("["),
    });

    shadowMap.push({
      main:
        node.original.key.end +
        source.slice(node.original.key.end, parensMain).indexOf("]"),
      shadow:
        node.key.end + output.slice(node.key.end, parensShadow).indexOf("]"),
    });
  }

  return {
    shadowMap,
  };
}

// yield 1;
function YieldExpression(node, source, output) {
  let shadowMap = [...Array(5)].map((_, i) => {
    return {
      main: node.original.start + i,
      shadow: node.start + i,
    };
  });

  if (node.delegate) {
    shadowMap.push({
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.argument.start)
          .indexOf("*"),
      shadow:
        node.start + output.slice(node.start, node.argument.start).indexOf("*"),
    });
  }

  return {
    shadowMap,
  };
}

// await 1;
function AwaitExpression(node, source, output) {
  let shadowMap = [...Array(5)].map((_, i) => {
    return {
      main: node.original.start + i,
      shadow: node.start + i,
    };
  });

  return {
    shadowMap,
  };
}

// (do {});
function DoExpression(node, source, output) {
  let shadowMap = [...Array(2)].map((_, i) => {
    return {
      main: node.original.start + i,
      shadow: node.start + i,
    };
  });

  return {
    shadowMap,
  };
}

// if (a) a; else if (b) b; else c;
function IfStatement(node, source, output) {
  let shadowMap = [
    // i
    {
      main: node.original.start,
      shadow: node.start,
    },
    // f
    {
      main: node.original.start + 1,
      shadow: node.start + 1,
    },
    // (
    {
      main:
        node.original.start +
        source
          .slice(node.original.start, node.original.test.start)
          .indexOf("("),
      shadow:
        node.start + output.slice(node.start, node.test.start).indexOf("("),
    },
    // )
    {
      main:
        node.original.test.end +
        source
          .slice(node.original.test.end, node.original.consequent.start)
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
          node.original.consequent.end +
          source
            .slice(node.original.consequent.end, node.original.alternate.start)
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
    node.original &&
    source.slice(node.original.start + 1, node.original.end - 1) ===
      output.slice(node.start, node.end)
  ) {
    let transformMap = [
      {
        main: node.original.start,
        cMain: source[node.original.start],
        shadow: node.start,
        cShadow: "",
      },
      {
        main: node.original.end - 1,
        cMain: source[node.original.end - 1],
        shadow: node.end - 1,
        cShadow: "",
      },
    ];

    let shadowMap = [];
    for (let i = 1; i <= node.original.value.length; i++) {
      shadowMap.push({
        main: node.original.start + i,
        cMain: source[node.original.start + i],
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

// `a`
// a`a`
// `a ${b} c`;
function TemplateLiteral(node, source, output) {
  let shadowMap = [
    // start `
    {
      main: node.original.start,
      shadow: node.start,
    },
    // end `
    {
      main: node.original.end - 1,
      shadow: node.end - 1,
    },
  ];

  let expressions = node.expressions.length;
  if (expressions > 0) {
    for (let i = 0; i < expressions; i++) {
      let dollarMain =
        node.original.quasis[i].start +
        source
          .slice(node.original.quasis[i].start, node.original.quasis[i + 1].end)
          .indexOf("${");
      let dollarShadow =
        node.quasis[i].start +
        output
          .slice(node.quasis[i].start, node.quasis[i + 1].end)
          .indexOf("${");
      shadowMap.push({
        main: dollarMain,
        shadow: dollarShadow,
      });
      shadowMap.push({
        main: dollarMain + 1,
        shadow: dollarShadow + 1,
      });
      shadowMap.push({
        main:
          node.original.quasis[i].start +
          source
            .slice(
              node.original.quasis[i].start,
              node.original.quasis[i + 1].end
            )
            .indexOf("}"),
        shadow:
          node.quasis[i].start +
          output
            .slice(node.quasis[i].start, node.quasis[i + 1].end)
            .indexOf("}"),
      });
    }
  }

  return {
    shadowMap,
  };
}

function NewExpression(node, source, output) {
  let shadowMap = CallExpression(node, source, output).shadowMap;

  [...Array("new".length)].forEach((_, i) => {
    shadowMap.push({
      main: node.original.start + i,
      shadow: node.start + i,
    });
  });

  return {
    shadowMap,
  };
}

// foo?.();
function OptionalCallExpression(node, source, output) {
  let result = CallExpression(node, source, output);

  if (node.optional) {
    let questionMain =
      node.original.callee.end +
      source.slice(node.original.callee.end, node.original.end).indexOf("?.");
    let shadowMain =
      node.callee.end + output.slice(node.callee.end, node.end).indexOf("?.");
    result.shadowMap.push(
      {
        main: questionMain,
        shadow: shadowMain,
      },
      {
        main: questionMain + 1,
        shadow: shadowMain + 1,
      }
    );
  }

  return result;
}

// a(a,b,c)
function CallExpression(node, source, output) {
  // for NewExpression
  let hasParen = source
    .slice(
      node.original.callee.end,
      node.original.arguments.length === 0
        ? node.original.end
        : node.original.arguments[0].start
    )
    .indexOf("(");

  let shadowMap = [];

  if (hasParen !== -1) {
    shadowMap.push(
      {
        main:
          node.original.callee.end +
          source
            .slice(
              node.original.callee.end,
              node.original.arguments.length === 0
                ? node.original.end
                : node.original.arguments[0].start
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
          node.original.arguments.length === 0
            ? node.original.callee.end +
              source
                .slice(node.original.callee.end, node.original.end)
                .lastIndexOf(")")
            : node.original.arguments[node.original.arguments.length - 1].end +
              source
                .slice(
                  node.original.arguments[node.original.arguments.length - 1]
                    .end,
                  node.original.end
                )
                .lastIndexOf(")"),
        shadow:
          node.arguments.length === 0
            ? node.callee.end +
              output.slice(node.callee.end, node.end).lastIndexOf(")")
            : node.arguments[node.arguments.length - 1].end +
              output
                .slice(node.arguments[node.arguments.length - 1].end, node.end)
                .lastIndexOf(")"),
      }
    );
  }
  node.arguments.forEach((argument, i) => {
    if (i < node.arguments.length - 1) {
      shadowMap.push({
        main:
          node.original.arguments[i].end +
          source
            .slice(
              node.original.arguments[i].end,
              node.original.arguments[i + 1].start
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
          node.original.meta.end +
          source
            .slice(node.original.meta.end, node.original.property.start)
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
          node.original.label.end +
          source
            .slice(node.original.label.end, node.original.body.start)
            .indexOf(":"),
        shadow:
          node.label.end +
          output.slice(node.label.end, node.body.start).indexOf(":"),
      },
    ],
  };
}

// [...a] = [1]
function RestElement(node, source, output) {
  return SpreadElement(node, source, output);
}

// var a = [...a]
function SpreadElement(node, source, output) {
  let shadowMap = [...Array(3)].map((_, i) => {
    return {
      main: node.original.start + i,
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
      main: node.original.start,
      shadow: node.start,
    },
    {
      main:
        node.original.start +
        source.slice(node.original.start, node.original.end).lastIndexOf("/"),
      shadow: node.start + output.slice(node.start, node.end).lastIndexOf("/"),
    },
  ];

  if (node.original.pattern === node.pattern) {
    [...Array(node.pattern.length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.start + 1 + i,
        shadow: node.start + 1 + i,
      });
    });
  }

  if (node.original.flags === node.flags) {
    [...Array(node.flags.length)].forEach((_, i) => {
      shadowMap.push({
        main: node.original.end - 1 - i,
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
    // mainStart: node.original.end - 1,
    // mainEnd: node.original.end,
    // shadowStart: node.end - 1,
    // shadowEnd: node.end,
    shadowMap: [
      {
        main: source[node.original.end - 1] === ";" && node.original.end - 1,
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
          node.original.name.end +
          source
            .slice(node.original.name.end, node.original.value.start)
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
          node.original.test.end +
          source
            .slice(node.original.test.end, node.original.consequent.start)
            .indexOf("?"),
        shadow:
          node.test.end +
          output.slice(node.test.end, node.consequent.start).indexOf("?"),
      },
      {
        main:
          node.original.consequent.end +
          source
            .slice(node.original.consequent.end, node.original.alternate.start)
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
          node.original.start +
          source
            .slice(node.original.start, node.original.argument.start)
            .indexOf(node.original.operator) +
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
        main: node.original.prefix
          ? node.original.start +
            source
              .slice(node.original.start, node.original.argument.start)
              .indexOf(node.original.operator) +
            i
          : node.original.argument.end +
            source
              .slice(node.original.argument.end, node.original.end)
              .indexOf(node.original.operator) +
            i,
        shadow: node.original.prefix
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
            node.original.object.end +
            source
              .slice(node.original.object.end, node.original.property.start)
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
            node.original.object.end +
            source
              .slice(node.original.object.end, node.original.property.start)
              .indexOf("["),
          shadow:
            node.object.end +
            output.slice(node.object.end, node.property.start).indexOf("["),
        },
        {
          main:
            node.original.property.end +
            source
              .slice(node.original.property.end, node.original.end)
              .indexOf("]"),
          shadow:
            node.property.end +
            output.slice(node.property.end, node.end).indexOf("]"),
        },
      ],
    };
  }
}

// foo?.bar;
// foo?.["bar"];
// foo?.bar["foo"];
// foo?.bar.foo;
function OptionalMemberExpression(node, source, output) {
  let shadowMap = [];

  let dotMain =
    node.original.object.end +
    source
      .slice(node.original.object.end, node.original.property.start)
      .indexOf(".");

  let dotShadow =
    node.object.end +
    output.slice(node.object.end, node.property.start).indexOf(".");

  if (!node.computed || node.optional) {
    shadowMap.push({
      main: dotMain,
      shadow: dotShadow,
    });
  }

  if (node.optional) {
    shadowMap.push({
      main: dotMain - 1,
      shadow: dotShadow - 1,
    });
  }

  if (node.computed) {
    shadowMap.push(
      {
        main:
          node.original.object.end +
          source
            .slice(node.original.object.end, node.original.property.start)
            .indexOf("["),
        shadow:
          node.object.end +
          output.slice(node.object.end, node.property.start).indexOf("["),
      },
      {
        main:
          node.original.property.end +
          source
            .slice(node.original.property.end, node.original.end)
            .indexOf("]"),
        shadow:
          node.property.end +
          output.slice(node.property.end, node.end).indexOf("]"),
      }
    );
  }

  return {
    shadowMap,
  };
}

function BinaryExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
          node.original.left.end +
          source
            .slice(node.original.left.end, node.original.right.start)
            .indexOf(node.original.operator) +
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
          node.original.left.end +
          source
            .slice(node.original.left.end, node.original.right.start)
            .indexOf(node.original.operator) +
          i,
        shadow:
          node.left.end +
          output.slice(node.left.end, node.right.start).indexOf(node.operator) +
          i,
      };
    }),
  };
}

// x **= y;
// x &&= y;
// x ||= y;
// x ??= y;
function AssignmentExpression(node, source, output) {
  return {
    shadowMap: [...Array(node.operator.length)].map((_, i) => {
      return {
        main:
          node.original.left.end +
          source
            .slice(node.original.left.end, node.original.right.start)
            .indexOf(node.original.operator) +
          i,
        shadow:
          node.left.end +
          output.slice(node.left.end, node.right.start).indexOf(node.operator) +
          i,
      };
    }),
  };
}

// ::a.b;
// a::b.c;
function BindExpression(node, source, output) {
  let shadowMap = [];

  let nodeHasObject = node => (node.object ? node.object.end : node.start);

  let colonMain =
    nodeHasObject(node.original) +
    source
      .slice(nodeHasObject(node.original), node.original.callee.start)
      .indexOf(":");

  let colonShadow =
    nodeHasObject(node) +
    output.slice(nodeHasObject(node), node.callee.start).indexOf(":");

  shadowMap.push(
    {
      main: colonMain,
      shadow: colonShadow,
    },
    {
      main: colonMain + 1,
      shadow: colonShadow + 1,
    }
  );

  return {
    shadowMap,
  };
}

// ({a = 1} = user)
function AssignmentPattern(node, source, output) {
  return {
    shadowMap: [
      {
        main:
          node.original.left.end +
          source
            .slice(node.original.left.end, node.original.right.start)
            .indexOf("="),
        shadow:
          node.left.end +
          output.slice(node.left.end, node.right.start).indexOf("="),
      },
    ],
  };
}

function ObjectProperty(node, source, output) {
  let shadowMap = [
    {
      main:
        !node.original.shorthand &&
        node.original.key.end +
          source
            .slice(node.original.key.end, node.original.value.start)
            .indexOf(":"),
      shadow:
        !node.shorthand &&
        node.key.end +
          output.slice(node.key.end, node.value.start).indexOf(":"),
    },
  ];

  if (node.computed) {
    shadowMap.push({
      main: node.original.computed && node.original.start,
      shadow: node.start,
    });
    shadowMap.push({
      main:
        node.original.computed &&
        node.original.key.end +
          source
            .slice(node.original.key.end, node.original.value.start)
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

// let { a, ...b } = c;
function ObjectPattern(node, source, output) {
  return ObjectExpression(node, source, output);
}

function ObjectExpression(node, source, output) {
  let shadowMap = [
    { main: node.original.start, shadow: node.start },
    { main: node.original.end - 1, shadow: node.end - 1 },
  ];
  node.properties.forEach((element, i) => {
    if (i < node.properties.length - 1) {
      shadowMap.push({
        main:
          node.original.properties[i].end +
          source
            .slice(node.original.properties[i].end, node.original.end)
            .indexOf(","),
        shadow:
          node.properties[i].end +
          output.slice(node.properties[i].end, node.end).indexOf(","),
      });
    }
  });
  let last = node.properties.length - 1;
  if (last > 0) {
    let mainTrailing = source
      .slice(node.original.properties[last].end, node.original.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.properties[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node.original.properties[last].end
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
    { main: node.original.start, shadow: node.start },
    { main: node.original.end - 1, shadow: node.end - 1 },
  ];
  return {
    shadowMap,
  };
}

function SequenceExpression(node, source, output) {
  let shadowMap = [];
  node.expressions.forEach((element, i) => {
    if (i < node.original.expressions.length - 1) {
      shadowMap.push({
        main:
          node.original.expressions[i].end +
          source
            .slice(
              node.original.expressions[i].end,
              node.original.expressions[i + 1].start
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

// [a, b, ...rest] = [10, 20, 30];
function ArrayPattern(node, source, output) {
  return ArrayExpression(node, source, output);
}

function ArrayExpression(node, source, output) {
  let shadowMap = [
    { main: node.original.start, shadow: node.start }, //
    {
      main: node.original.end - 1,
      shadow: node.end - 1,
    },
  ];
  node.elements.forEach((element, i) => {
    if (i < node.original.elements.length - 1) {
      if (
        node.original.elements[i] === null ||
        node.original.elements[i + 1] === null
      ) {
        // TODO: sparse arrays
        console.error("TODO: doesn't handle sparse arrays [1,,2] yet");
      } else {
        shadowMap.push({
          main:
            node.original.elements[i].end +
            source
              .slice(node.original.elements[i].end, node.original.end)
              .indexOf(","),
          shadow:
            node.elements[i].end +
            output.slice(node.elements[i].end, node.end).indexOf(","),
        });
      }
    }
  });
  let last = node.elements.length - 1;
  if (last > 0) {
    let mainTrailing = source
      .slice(node.original.elements[last].end, node.original.end)
      .indexOf(",");
    let shadowTrailing = output
      .slice(node.elements[last].end, node.end)
      .indexOf(",");
    if (shadowTrailing !== -1) {
      shadowMap.push({
        main:
          mainTrailing !== -1
            ? mainTrailing + node.original.elements[last].end
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
  let _sourceNode = node._sourceNode.extra.raw;
  [...Array(_sourceNode.length)].forEach((_, i) => {
    if (_sourceNode[i] !== "_") {
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

function JSXIdentifier_to_Identifier(node) {
  return {
    shadowMap: [
      ...Array(node._sourceNode.end - node._sourceNode.start).keys(),
    ].map(i => ({
      main: node._sourceNode.start + i,
      shadow: node.start + i,
    })),
  };
}

export default function makeShadowMap(node, source, output) {
  if (node._sourceNode) {
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
        shadowMap.push({
          main: node._sourceNode.end - 1,
          shadow: node.end - 1,
        });
      }
      return {
        shadowMap,
        transformMap,
      };
    }
  }

  if (!node.original) return -1;

  let fn = shadowMapFunctions[node.type];
  if (fn && node.original.type === node.type) {
    let result = fn(node, source, output);

    if (node?.extra?.parenthesized) {
      result.shadowMap.push(
        {
          main: node.original.start - 1,
          shadow: node.start - 1,
        },
        {
          main: node.original.end,
          shadow: node.end,
        }
      );
    }

    return result;
  }

  // why only in node.original and not node._sourceNode?
  if (node.original.type === "JSXIdentifier" && node.type === "Identifier") {
    return JSXIdentifier_to_Identifier(node);
  }

  if (
    // same type
    // preventing something like unhandled node (ObjectPattern -> Identifier)
    node.type === node.original.type &&
    (node.type === "Identifier" ||
      node.type === "BooleanLiteral" ||
      node.type === "NullLiteral" ||
      node.type === "NumericLiteral" ||
      node.type === "BigIntLiteral" ||
      node.type === "DecimalLiteral" ||
      node.type === "DebuggerStatement" ||
      node.type === "Directive" ||
      node.type === "InterpreterDirective" ||
      node.type === "Import" ||
      node.type === "Super" ||
      node.type === "TemplateElement" ||
      node.type === "ThisExpression" ||
      node.type === "EmptyStatement")
  ) {
    return;
    // ignore
  } else if (
    node.type === "TaggedTemplateExpression" ||
    node.type === "ImportDefaultSpecifier"
  ) {
    return -1;
  } else {
    console.error(
      `unsupported! original: ${node.original.type}, type: ${node.type}`
    );
    return -1;
  }
}
