import type { TextlintRuleReporter } from "@textlint/types";
import type { TxtNode } from "@textlint/ast-node-types";
import { matchPatterns } from "@textlint/regexp-string-matcher";
import { RuleHelper } from "textlint-rule-helper";
import * as jsYaml from "js-yaml";
import * as fs from "node:fs";
import Ajv from "ajv";

export type rulePaths = fs.PathOrFileDescriptor[];

export type Pattern = {
    /**
     * This error message will be shown when match the pattern
     */
    suggest?: string;
    /**
     * Match pattern string.
     * You can use RegExp-like string.
     * https://github.com/textlint/regexp-string-matcher#regexp-like-string
     */
    pattern: string | string[];
    /**
     * Replace string
     * You can use capture pattern like $1, $2. ($0 will be ignored)
     */
    expected: string;
    /**
     * An array of excludes pattern.
     * If the text is matched this pattern, suppress the error.
     * You can use RegExp-like string
     * https://github.com/textlint/regexp-string-matcher#regexp-like-string
     */
    allows?: string[];
    /**
     * An array for excludes node type.
     * If the text is in the node type, suppress the error.
     * https://github.com/textlint/textlint/blob/master/docs/txtnode.md#type
     * For example, if you want to ignore the text in block quote and link
     * "allowNodeTypes": ["Link", "BlockQuote"]
     */
    allowNodeTypes?: string[];
    /**
     * This rule ignore Code and CodeBlock by default.
     * If you want to check the code, please put this true
     */
    forceCode?: boolean;
    regexpMustEmpty?: string;
    specs?: spec[];
};

export type spec = {
    from: string;
    to: string;
};

export type YamlRule = {
    rules: Pattern[];
};

export type Options = {
    rulePaths?: string[];
    patterns: Pattern[];
};

const replace = (text: string, captures: string[]) => {
    return text.replace(/\$([1-9])/g, (match, indexStr) => {
        const index = Number(indexStr);
        if (Number.isNaN(index)) {
            throw new Error(`Something wrong. ${indexStr} is NaN. `);
        }
        // if does not match capture, return original text
        // captures is align with [$1, $2, $3 ....]
        return captures[index - 1] ?? match;
    });
};
const report: TextlintRuleReporter<Options> = (context, options) => {
    const { Syntax, report, RuleError, fixer, getSource } = context;
    const rules = options?.patterns ?? [];
    const helper = new RuleHelper(context);
    const rulePaths = options?.rulePaths ?? [];

    const createRulesFromYaml = (rulePaths: fs.PathOrFileDescriptor[]) => {
        if (rulePaths.length === 0) {
            return [];
        }
        let result: Pattern[] = [];
        for (const p of rulePaths) {
            try {
                const rule = jsYaml.load(fs.readFileSync(p, "utf8")) as YamlRule;
                result = result.concat(rule.rules);
            } catch (e) {
                if (e instanceof jsYaml.YAMLException) {
                    console.log(`${e.name}: ${e.message}`);
                    throw new Error();
                }
            }
        }
        return result;
    };

    const validatePattern = (patterns: Pattern[]) => {
        const ajv = new Ajv();
        const patternSchema = JSON.parse(fs.readFileSync("./schema.json").toString());
        const validate = ajv.compile(patternSchema);
        const errorMessage: string[] = [];
        for (const p of patterns)
            if (!validate(p)) {
                const mes = `次のルールの表記に誤りがあります。\n${JSON.stringify(
                    p,
                    null,
                    " "
                )}\nエラーメッセージ\n ${JSON.stringify(validate.errors, null, " ")}`;
                errorMessage.push(mes);
            }
        if (errorMessage.length>0) throw new Error(errorMessage.join("\n"));
    };

    const rule = rules.concat(createRulesFromYaml(rulePaths) ?? []);
    validatePattern(rule);

    const reportIfError = (node: TxtNode) => {
        const text = getSource(node);
        for (const pattern of rule) {
            const isCodeNode = node.type === Syntax.Code || node.type === Syntax.CodeBlock;
            if (isCodeNode && !pattern.forceCode) {
                continue;
            }
            const pat = !Array.isArray(pattern.pattern) ? [pattern.pattern] : pattern.pattern;
            const results = matchPatterns(text, pat);
            for (const result of results) {
                const index = result.startIndex || 0;
                const match = result.match || "";
                const allowedResults = pattern.allows ? matchPatterns(match, pattern.allows) : [];
                if (allowedResults.length > 0) {
                    continue; // suppress the error
                }
                if (pattern.regexpMustEmpty && result.captures[Number(pattern.regexpMustEmpty.slice(1)) - 1]) {
                    continue;
                }
                const allowNodeTypes = pattern.allowNodeTypes ?? [];
                if (helper.isChildNode(node, allowNodeTypes)) {
                    return; // suppress the error
                }
                const replaceText = replace(pattern.expected, result.captures);
                report(
                    node,
                    new RuleError(`${result.match} => ${replaceText}${pattern.suggest ? " :" + pattern.suggest : ""}`, {
                        index: index,
                        fix: fixer.replaceTextRange([index, index + match.length], replaceText)
                    })
                );
            }
        }
    };
    return {
        [Syntax.Document](node) {
            if (rule.length === 0) {
                report(
                    node,
                    new RuleError("You should set patterns at least one", {
                        index: 0
                    })
                );
            }
        },
        [Syntax.Str](node) {
            reportIfError(node);
        },
        [Syntax.Comment](node) {
            reportIfError(node);
        },
        [Syntax.Code](node) {
            reportIfError(node);
        },
        [Syntax.CodeBlock](node) {
            reportIfError(node);
        }
    };
};
export default {
    rule: [],
    linter: report,
    fixer: report
};
