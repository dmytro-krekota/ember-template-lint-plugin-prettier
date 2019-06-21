// inspiration here: https://github.com/prettier/eslint-plugin-prettier/blob/master/eslint-plugin-prettier.js
const {
  showInvisibles,
  generateDifferences
} = require("prettier-linter-helpers");

const { INSERT, DELETE, REPLACE } = generateDifferences;

let prettier;

const Rule = require("ember-template-lint").Rule;

const PrettierRule = class Prettier extends Rule {
  visitor() {
    if (prettier && prettier.clearConfigCache) {
      prettier.clearConfigCache();
    }

    return {
      Program(node) {
        const source = this.sourceForNode(node);
        const filepath = this.templateEnvironmentData.moduleName;

        if (!prettier) {
          // Prettier is expensive to load, so only load it if needed.
          prettier = require("prettier");
        }

        const prettierRcOptions = prettier.resolveConfig.sync(filepath, {
          editorconfig: true
        });

        const prettierFileInfo = prettier.getFileInfo.sync(filepath, {
          ignorePath: ".prettierignore"
        });

        // Skip if file is ignored using a .prettierignore file
        if (prettierFileInfo.ignored) {
          return;
        }

        const prettierOptions = Object.assign(
          {},
          { parser: "glimmer" },
          prettierRcOptions,
          {
            filepath
          }
        );

        let prettierSource;
        try {
          prettierSource = prettier.format(source, prettierOptions);
        } catch (err) {
          if (!(err instanceof SyntaxError)) {
            throw err;
          }

          let message = "Parsing error: " + err.message;

          // Prettier's message contains a codeframe style preview of the
          // invalid code and the line/column at which the error occured.
          // ESLint shows those pieces of information elsewhere already so
          // remove them from the message
          if (err.codeFrame) {
            message = message.replace(`\n${err.codeFrame}`, "");
          }
          if (err.loc) {
            message = message.replace(/ \(\d+:\d+\)$/, "");
          }

          this.log({
            message,
            line: node.loc && node.loc.start.line,
            column: node.loc && node.loc.start.column,
            source: this.sourceForNode(node)
          });

          return;
        }

        if (source !== prettierSource) {
          const differences = generateDifferences(source, prettierSource);

          differences.forEach(difference => {
            let message = "";

            switch (difference.operation) {
              case INSERT:
                message = `Insert {{ ${showInvisibles(
                  difference.insertText
                )} }}`;
                break;
              case DELETE:
                message = `Delete {{ ${showInvisibles(
                  difference.deleteText
                )} }}`;
                break;
              case REPLACE:
                message = `Replace {{ ${showInvisibles(
                  difference.deleteText
                )} }} with {{ ${difference.insertText} }}`;
                break;
            }

            this.log({
              message,
              line: node.loc && node.loc.start.line,
              column: node.loc && node.loc.start.column,
              source: this.sourceForNode(node)
            });
          });
        }
      }
    };
  }
};

module.exports = {
  name: "ember-template-lint-plugin-prettier",

  rules: {
    prettier: PrettierRule
  },

  // Define configurations for this plugin that can be extended by the base configuration
  configurations: {
    recommended: {
      plugins: ["ember-template-lint-plugin-prettier"],
      rules: {
        prettier: true
      }
    }
  }
};
