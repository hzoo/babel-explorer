import { stringLiteral } from "../../builders/generated";
import type * as t from "../..";

export default function cleanJSXElementLiteralChild(
  child: {
    value: string;
  },
  args: Array<t.Node>,
) {
  const lines = child.value.split(/\r\n|\n|\r/);

  let lastNonEmptyLine = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmptyLine = i;
    }
  }

  let str = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;

    // replace rendered whitespace tabs with spaces
    let trimmedLine = line.replace(/\t/g, " ");

    // trim whitespace touching a newline
    if (!isFirstLine) {
      trimmedLine = trimmedLine.replace(/^[ ]+/, "");
    }

    // trim whitespace touching an endline
    if (!isLastLine) {
      trimmedLine = trimmedLine.replace(/[ ]+$/, "");
    }

    if (trimmedLine) {
      if (!isLastNonEmptyLine) {
        trimmedLine += " ";
      }

      str += trimmedLine;
    }
  }

  if (str) {
    let temp = stringLiteral(str);
    if (!temp._originalLoc) {
      temp._originalLoc = {
        type: "JSXText",
        start: child.start + child.value.indexOf(str),
        end: child.start + child.value.indexOf(str) + str.length,
      };
    }
    args.push(temp);
  }
}
