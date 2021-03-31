import { declare } from "@babel/helper-plugin-utils";
import syntaxNumericSeparator from "@babel/plugin-syntax-numeric-separator";

/**
 * Given a bigIntLiteral or NumericLiteral, remove numeric
 * separator `_` from its raw representation
 *
 * @param {NodePath<BigIntLiteral | NumericLiteral>} { node }: A Babel AST node path
 */
function remover({ node }: NodePath<BigIntLiteral | NumericLiteral>) {
  const { extra } = node;
  if (extra?.raw?.includes("_")) {
    if (!node._originalLoc) {
      node._originalLoc = {
        start: node.start,
        end: node.end,
        extra: {
          raw: node.extra.raw,
        },
      };
    }
    extra.raw = extra.raw.replace(/_/g, "");
  }
}

export default declare(api => {
  api.assertVersion(7);

  return {
    name: "proposal-numeric-separator",
    inherits: syntaxNumericSeparator,

    visitor: {
      NumericLiteral: remover,
      BigIntLiteral: remover,
    },
  };
});
