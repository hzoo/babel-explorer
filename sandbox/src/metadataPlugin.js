const path = require("path");
function normalize(src) {
  return src.replace(/\//, path.sep);
}

module.exports = function babelPlugin(babel) {
  const { types: t, template } = babel;

  return {
    name: "transform-babel-metadata",
    visitor: {
      // + replaceWithMultiple
      // path.replaceWith(a) -> path.replaceWith(a, "name")
      // TODO: handle nested MemberExpression like a.b.replaceWith
      CallExpression(path, state) {
        state.filename = state.filename || "babel-plugin-custom/src.js";
        if (
          path.node.callee.type === "MemberExpression" &&
          path.node.callee.property.type === "Identifier" &&
          [
            "replaceWith",
            "replaceWithMultiple",
            "insertAfter",
            "insertBefore",
            "addHelper",
          ].some(a => a === path.node.callee.property.name)
        ) {
          const currentPath =
            (path.node.callee.object.type === "Identifier" &&
              path.node.callee.object.name) ||
            "path";
          const pluginName = normalize(state.filename).match(
            /babel-(plugin|helper)-((\w+-?)+)/
          )[2];
          /*
            Allow specifying a node to get correct start/end
            (instead of defaulting to this.node).

            // node: rest
            target.insertBefore(loop);
          */
          const hasComment = path.parentPath.node.leadingComments;
          let comment;
          if (hasComment && hasComment.length) {
            comment = hasComment[0].value.match(/node: (.*)/);
            if (comment) {
              comment = template.expression(comment[1])();
            }
          }
          // "C:\\Users\\babel\\packages\\babel-plugin-proposal-unicode-property-regex\\src\\index.js".match(/babel-(plugin|helper)-((\w+-?)+)/)
          // {
          //   name: "unicode-property-regex",
          //   file: "babel-plugin-proposal-unicode-property-regex\\src\\index.js",
          //   start: 0,
          //   end: 1,
          // }
          const props = [
            t.objectProperty(t.identifier("name"), t.stringLiteral(pluginName)),
            t.objectProperty(
              t.identifier("file"),
              t.stringLiteral(
                `${normalize(state.filename).substr(
                  normalize(state.filename).indexOf(pluginName)
                )} (${path.node.loc.start.line}:${path.node.loc.start.column})`
              )
            ),
          ];
          const start = comment
            ? t.objectProperty(
                t.identifier("start"),
                t.memberExpression(comment, t.identifier("start"))
              )
            : path.scope.hasBinding(currentPath)
            ? t.objectProperty(
                t.identifier("start"),
                t.optionalMemberExpression(
                  t.optionalMemberExpression(
                    t.identifier(currentPath),
                    t.identifier("node"),
                    false,
                    true
                  ),
                  t.identifier("start"),
                  false,
                  true
                )
              )
            : null;
          if (start) props.push(start);
          const end = comment
            ? t.objectProperty(
                t.identifier("end"),
                t.memberExpression(comment, t.identifier("end"))
              )
            : path.scope.hasBinding(currentPath)
            ? t.objectProperty(
                t.identifier("end"),
                t.optionalMemberExpression(
                  t.optionalMemberExpression(
                    t.identifier(currentPath),
                    t.identifier("node"),
                    false,
                    true
                  ),
                  t.identifier("end"),
                  false,
                  true
                )
              )
            : null;
          if (end) props.push(end);
          const node = comment
            ? t.objectProperty(t.identifier("node"), comment)
            : path.scope.hasBinding(currentPath)
            ? t.objectProperty(
                t.identifier("node"),
                t.optionalMemberExpression(
                  t.identifier(currentPath),
                  t.identifier("node"),
                  false,
                  true
                )
              )
            : null;
          if (node) props.push(node);
          const metaNode = t.objectExpression(props);
          if (path.addMetadata) {
            path.addMetadata(metaNode, "transform-babel-metadata");
          }
          path.node.arguments.push(metaNode);
        }
      },
    },
  };
};
