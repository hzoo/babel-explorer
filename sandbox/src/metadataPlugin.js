const path = require("path");
const BABEL_PACKAGES_REGEXP =
  path.sep === "/" ? /packages\/(.*)/ : /packages\\(.*)/;

module.exports = function babelPlugin(babel) {
  const { types: t, template } = babel;

  function getMetaComment(path) {
    /*
      Allow specifying a node to get correct start/end
      (instead of defaulting to this.node).

      // node: rest
      target.insertBefore(loop);
    */
    const hasComment = path.parentPath.node.leadingComments;
    let comment;
    if (hasComment && hasComment.length) {
      comment = hasComment[hasComment.length - 1].value.match(/node: (.*)/);
      if (comment) {
        // remove the comment?
        path.parentPath.node.leadingComments = [];
        comment = template.expression(comment[1])();
      }
    }
    return comment;
  }

  return {
    name: "transform-babel-metadata",
    pre(state) {
      const filename =
        state.opts.filename || "babel/packages/babel-plugin-custom/index.js";
      this.filePath = filename.match(BABEL_PACKAGES_REGEXP)[1];
      this.pluginName = this.filePath.match(/^[^(/|\\)]*/)[0];
    },
    visitor: {
      /*
      node.babelPlugin = [{
        name: "proposal-numeric-separator",
        file: "proposal-numeric-separator\\src\\index.js (16:10)",
        start: node.start,
        end: node.end
      }]
      extra.raw = extra.raw.replace(/_/g, "");
      */
      AssignmentExpression(path, state) {
        const comment = getMetaComment(path);
        if (!comment) return;
        const props = [
          t.objectProperty(
            t.identifier("name"),
            t.stringLiteral(this.pluginName)
          ),
          t.objectProperty(
            t.identifier("file"),
            t.stringLiteral(
              `${this.filePath} (${path.node.loc.start.line}:${path.node.loc.start.column})`
            )
          ),
          t.objectProperty(
            t.identifier("start"),
            t.memberExpression(comment, t.identifier("start"))
          ),
          t.objectProperty(
            t.identifier("end"),
            t.memberExpression(comment, t.identifier("end"))
          ),
        ];
        const metaNode = t.objectExpression(props);

        path.insertBefore(
          t.assignmentExpression(
            "=",
            t.memberExpression(comment, t.identifier("babelPlugin")),
            t.arrayExpression([metaNode])
          )
        );
      },
      // pathX.replaceWith(a) -> pathX.replaceWith(a, { name: "name" })
      // TODO: handle nested MemberExpression like a.b.replaceWith
      // TODO: CallExpression like path.get("left").replaceWith
      CallExpression(path, state) {
        if (
          path.node.callee.type === "MemberExpression" &&
          path.node.callee.property.type === "Identifier" &&
          [
            "replaceWith",
            "replaceWithMultiple",
            "insertAfter",
            "insertBefore",
          ].some(a => a === path.node.callee.property.name)
        ) {
          // if the path is other than path.replaceWith (parent.replaceWith)
          const currentPath =
            (path.node.callee.object.type === "Identifier" &&
              path.node.callee.object.name) ||
            "path";
          const comment = getMetaComment(path);
          // "C:\\Users\\babel\\packages\\babel-plugin-proposal-unicode-property-regex\\src\\index.js".match(/babel-(plugin|helper)-((\w+-?)+)/)
          // {
          //   name: "unicode-property-regex",
          //   file: "babel-plugin-proposal-unicode-property-regex\\src\\index.js",
          //   start: 0,
          //   end: 1,
          // }
          const props = [
            t.objectProperty(
              t.identifier("name"),
              t.stringLiteral(this.pluginName)
            ),
            t.objectProperty(
              t.identifier("file"),
              t.stringLiteral(
                `${this.filePath} (${path.node.loc.start.line}:${path.node.loc.start.column})`
              )
            ),
          ];
          const pathInScope = path.scope.hasBinding(currentPath);
          const currentPathNode = t.identifier(currentPath);
          const start = comment
            ? t.objectProperty(
                t.identifier("start"),
                t.memberExpression(comment, t.identifier("start"))
              )
            : pathInScope
            ? t.objectProperty(
                t.identifier("start"),
                t.optionalMemberExpression(
                  t.optionalMemberExpression(
                    currentPathNode,
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
            : pathInScope
            ? t.objectProperty(
                t.identifier("end"),
                t.optionalMemberExpression(
                  t.optionalMemberExpression(
                    currentPathNode,
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
          // TODO: do something with ast node?
          // const node = comment
          //   ? t.objectProperty(t.identifier("node"), comment)
          //   : pathInScope
          //   ? t.objectProperty(
          //       t.identifier("node"),
          //       t.optionalMemberExpression(
          //         currentPathNode,
          //         t.identifier("node"),
          //         false,
          //         true
          //       )
          //     )
          //   : null;
          // if (node) props.push(node);
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
