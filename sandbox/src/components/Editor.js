import "codemirror/mode/javascript/javascript";
import React from "react";
import styled from "styled-components";
import { Controlled as CodeMirror } from "react-codemirror2";

const StyledEditor = styled(CodeMirror)`
  position: relative;
  height: 100%;

  .CodeMirror {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    margin: 4px;
    height: inherit;
  }

  .CodeMirror-activeline-background {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .CodeMirror-simplescroll-vertical {
    height: 0;
  }
`;

export function Editor({
  className,
  onChange,
  getEditor,
  onCursor,
  onSelection,
  style,
  ...options
}) {
  return (
    <StyledEditor
      className={className}
      onBeforeChange={(editor, data, value) => {
        onChange(value);
      }}
      options={{
        scrollbarStyle: null,
        lineNumbers: true,
        theme: "material",
        ...options.config,
      }}
      style={style}
      value={options.value}
      editorDidMount={editor => {
        // handle whitespace
        // https://github.com/coderaiser/cm-show-invisibles
        editor.addOverlay({
          name: "invisibles",
          token: function nextToken(stream) {
            let spaces = 0;
            let peek = stream.peek() === " ";

            if (peek) {
              while (peek && spaces < 8) {
                ++spaces;

                stream.next();
                peek = stream.peek() === " ";
              }

              let ret = "whitespace whitespace-" + spaces;

              /*
               * styles should be different
               * could not be two same styles
               * beside because of this check in runmode
               * function in `codemirror.js`:
               *
               * 6624: if (!flattenSpans || curStyle != style) {}
               */
              if (spaces === 8) ret += " whitespace-rand-" + Count++;

              return ret;
            }

            while (!stream.eol() && !peek) {
              stream.next();

              peek = stream.peek() === " ";
            }

            return "cm-eol";
          },
        });
        if (getEditor) getEditor(editor);
      }}
      onCursor={(editor, data) => {
        if (onCursor) onCursor(data);
      }}
      onSelection={(editor, data) => {
        if (onSelection) onSelection(data);
      }}
    />
  );
}
