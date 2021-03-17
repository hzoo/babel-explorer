const path = require("path");
const BABEL_PACKAGES_REGEXP =
  path.sep === "/" ? /packages\/(.*)/ : /packages\\(.*)/;

const { addNamespace } = require("@babel/helper-module-imports");

module.exports = function (babel) {
  const { types: t, template } = babel;

  function getMetaComment(path) {
    /*
      Allow specifying a node to get correct start/end
      (instead of defaulting to this.node).

      // node: rest <-- check first comment
      // @ts-expect-error todo(flow->ts): avoid mutating nodes
      target.insertBefore(loop);
    */
    const hasComment = path.parentPath.node.leadingComments;
    let comment;
    if (hasComment && hasComment.length) {
      // top comment
      comment = hasComment[0].value.match(/node: (.*)/);
      if (comment) {
        // remove the comment?
        path.parentPath.node.leadingComments = [];
        comment = template.expression(comment[1])();
      }
    }
    return comment;
  }

  return {
    name: "transform-babel-plugin-metadata",
    pre(state) {
      const filename =
        state.opts.filename || "babel/packages/babel-plugin-custom/index.js";
      this.filePath = filename;
      this.pluginName = this.filePath
        .match(BABEL_PACKAGES_REGEXP)[1]
        .match(/^[^(/|\\)]*/)[0];
    },
    visitor: {
      /*
      node._sourceNodes = [{
        plugin: "proposal-numeric-separator",
        file: "proposal-numeric-separator\\src\\index.js (16:10)",
        start: node.start,
        end: node.end
      }]
      extra.raw = extra.raw.replace(/_/g, "");
      */
      AssignmentExpression(path, state) {
        const comment = getMetaComment(path);
        if (!comment) return;

        const pathInScope = path.scope.hasBinding("t");
        let babelTypesRef = t.identifier("t");
        if (!pathInScope) {
          babelTypesRef = state.addBabelTypes;
          if (babelTypesRef) {
            babelTypesRef = t.cloneNode(babelTypesRef);
          } else {
            babelTypesRef = state.addBabelTypes = addNamespace(
              path,
              "@babel/types",
              {
                nameHint: "t",
              }
            );
          }
        }

        const props = [
          t.objectProperty(
            t.identifier("plugin"),
            t.stringLiteral(this.pluginName)
          ),
          t.objectProperty(
            t.identifier("file"),
            t.stringLiteral(
              `vscode://file/${this.filePath}:${path.node.loc.start.line}:${path.node.loc.start.column}`
            )
          ),
          t.spreadElement(
            t.callExpression(
              t.memberExpression(babelTypesRef, t.identifier("cloneNode")),
              [comment, t.booleanLiteral(true)]
            )
          ),
        ];
        const metaNode = t.objectExpression(props);

        /*
          let _babelPlugin = Object.assign({
            plugin: "babel-plugin-transform-shorthand-properties",
            file: "vscode://file/C:\\Users\\Hen\\win-dev\\babel\\packages\\babel-plugin-transform-shorthand-properties\\src\\index.js:40:12"
          }, t.cloneNode(node, true));
          node._sourceNodes = node._sourceNodes ? [...node._sourceNodes, _babelPlugin] : [_babelPlugin]
          node.shorthand = false;
        */
        let temp = path.scope.generateUidIdentifier("babelPlugin");
        path.insertBefore([
          t.variableDeclaration("let", [t.variableDeclarator(temp, metaNode)]),
          t.assignmentExpression(
            "=",
            t.memberExpression(comment, t.identifier("_sourceNodes")),
            t.conditionalExpression(
              t.memberExpression(comment, t.identifier("_sourceNodes")),
              t.arrayExpression([
                t.spreadElement(
                  t.memberExpression(comment, t.identifier("_sourceNodes"))
                ),
                temp,
              ]),
              t.arrayExpression([temp])
            )
          ),
        ]);
      },

      //  pathX.replaceWith(a) -> pathX.replaceWith(a, {
      //   plugin: "babel-plugin-transform-template-literals",
      //   file: "babel-plugin-transform-template-literals/src/index.js:89:8",
      //   ...t.cloneNode(path.node, true),
      // })
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
            "unshiftContainer",
            "pushContainer",
          ].some(a => a === path.node.callee.property.name)
        ) {
          // if the path is other than path.replaceWith (parent.replaceWith)
          const currentPath = path.get("callee.object");
          const comment = getMetaComment(path);
          // "C:\\Users\\babel\\packages\\babel-plugin-proposal-unicode-property-regex\\src\\index.js".match(/babel-(plugin|helper)-((\w+-?)+)/)
          // {
          //   plugin: "unicode-property-regex",
          //   file: "babel-plugin-proposal-unicode-property-regex\\src\\index.js",
          //   start: 0,
          //   end: 1,
          // }
          const props = [
            t.objectProperty(
              t.identifier("plugin"),
              t.stringLiteral(this.pluginName)
            ),
            t.objectProperty(
              t.identifier("file"),
              // vscode://file/C:\Users\Hen\win-dev\babel\packages\babel-helper-builder-react-jsx\src\index.js:34:8
              t.stringLiteral(
                `vscode://file/${this.filePath}:${path.node.loc.start.line}:${path.node.loc.start.column}`
              )
            ),
          ];

          const pathInScope = path.scope.hasBinding("t");
          let babelTypesRef = t.identifier("t");
          if (!pathInScope) {
            babelTypesRef = state.addBabelTypes;
            if (babelTypesRef) {
              babelTypesRef = t.cloneNode(babelTypesRef);
            } else {
              babelTypesRef = state.addBabelTypes = addNamespace(
                path,
                "@babel/types",
                {
                  nameHint: "t",
                }
              );
            }
          }

          const currentPathNode = currentPath.node;
          props.push(
            t.spreadElement(
              t.callExpression(
                t.memberExpression(babelTypesRef, t.identifier("cloneNode")),
                [
                  comment
                    ? comment
                    : t.optionalMemberExpression(
                        currentPathNode,
                        t.identifier("node"),
                        false,
                        true
                      ),
                  t.booleanLiteral(true),
                ]
              )
            )
          );
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
