import TextLintTester from "textlint-tester";
import rule from "../src/index";

const tester = new TextLintTester();
const testOptions = {
    patterns: [
        {
            pattern: "/(\\d{4})/(\\d{2})/(\\d{2})/i",
            expected: "$1-$2-$3",
            // special
            allows: ["/1000/01/01/"]
        },
        {
            pattern: "/([^使])([いくすたつのる])方([ぁ-め,や-んァ-ヶ])/",
            expected: "$1$2ほう$3",
            // special
            allows: ["ほげ方です"]
        },
        {
            pattern: "/([き]?)あが([らりるれろっ])/",
            expected: "上が$2",
            regexpMustEmpty: "$1",
            // special
            allows: ["ほげ方です"]
        },
        {
            pattern: "/hoge-huga/",
            expected: "HOGE-HUGA"
        },
        {
            pattern: "/([き]?)あが([らりるれろっ])/",
            expected: "上が$2",
            regexpMustEmpty: "$1",
            // special
            allows: ["ほげ方です"]
        },
        {
            pattern: "最も",
            expected: "もっとも",
            suggest: "<接続詞の場合は開く（誤記。正しくは「尤も」）"
        }
    ]
};
tester.run("textlint-rule-standardizer", rule, {
    valid: [
        {
            text: "2000-01-01",
            options: testOptions
        },
        {
            text: "使い方は",
            options: testOptions
        },
        {
            text: "ほげ方です",
            options: testOptions
        },
        {
            text: "できあがる",
            options: testOptions
        }
    ],
    invalid: [
        {
            text: "2000/01/01",
            options: testOptions,
            errors: [
                {
                    message: "2000/01/01 => 2000-01-01",
                    index: 0
                }
            ]
        },
        {
            text: "これを買った方が",
            options: testOptions,
            errors: [
                {
                    message: "った方が => ったほうが",
                    index: 4
                }
            ]
        },
        {
            text: "最も",
            options: testOptions,
            errors: [
                {
                    message: "最も => もっとも :<接続詞の場合は開く（誤記。正しくは「尤も」）",
                    index: 0
                }
            ]
        },
        {
            text: "階段をあがると",
            options: testOptions,
            errors: [
                {
                    message: "あがる => 上がる",
                    index: 3
                }
            ]
        },
        {
            text: "hoge-huga",
            options: testOptions,
            errors: [
                {
                    message: "hoge-huga => HOGE-HUGA",
                    index: 0
                }
            ]
        }
        // code
    ]
});
