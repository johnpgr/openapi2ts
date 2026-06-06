import assert from "node:assert/strict";
import { test } from "node:test";
import { applyEntityNameCase } from "../../src/utils/string-utils.ts";

// Some of the test cases were taken from https://github.com/sindresorhus/camelcase/blob/main/test.js
const camelCaseTestCases = {
    foo: "foo",
    IDs: "ids",
    FooIDs: "fooIds",
    "foo-bar": "fooBar",
    "foo-bar-baz": "fooBarBaz",
    "foo--bar": "fooBar",
    "--foo-bar": "fooBar",
    "--foo--bar": "fooBar",
    "FOO-BAR": "fooBar",
    "-foo-bar-": "fooBar",
    "--foo--bar--": "fooBar",
    "foo-1": "foo1",
    "foo.bar": "fooBar",
    "foo..bar": "fooBar",
    "..foo..bar..": "fooBar",
    foo_bar: "fooBar",
    __foo__bar__: "fooBar",
    "foo bar": "fooBar",
    "  foo  bar  ": "fooBar",
    "-": "",
    " - ": "",
    fooBar: "fooBar",
    "fooBar-baz": "fooBarBaz",
    "fooBarBaz-bazzy": "fooBarBazBazzy",
    FBBazzy: "fbBazzy",
    F: "f",
    FooBar: "fooBar",
    Foo: "foo",
    FOO: "foo",
    "--": "",
    "": "",
    _: "",
    " ": "",
    ".": "",
    "..": "",
    "  ": "",
    __: "",
    "--__--_--_": "",
    XMLHttpRequest: "xmlHttpRequest",
    AjaxXMLHttpRequest: "ajaxXmlHttpRequest",
    "Ajax-XMLHttpRequest": "ajaxXmlHttpRequest",
    "mGridCol6@md": "mGridCol6Md",
    "A::a": "aA",
    Hello1World: "hello1World",
    Hello11World: "hello11World",
    hello1world: "hello1World",
    Hello1World11foo: "hello1World11Foo",
    Hello1: "hello1",
    hello1: "hello1",
    BaseV1ApiClient: "baseV1ApiClient",
    h2w: "h2W",
};

test("applyEntityNameCase formats sentences and filenames", () => {
    assert.equal(applyEntityNameCase("Hello World!", "kebabCase"), "hello-world");
    assert.equal(applyEntityNameCase("filename-without-ext", "snakeCase"), "filename_without_ext");
    assert.equal(applyEntityNameCase("CONST_NAME_EXAMPLE", "pascalCase"), "ConstNameExample");
    assert.equal(
        applyEntityNameCase("simpleCamelCaseString", "kebabCase"),
        "simple-camel-case-string",
    );
    assert.equal(applyEntityNameCase("openAPILibrary", "kebabCase"), "open-api-library");
    assert.equal(applyEntityNameCase("publicV2Api", "kebabCase"), "public-v2-api");
});

test("applyEntityNameCase matches camelCase reference cases", () => {
    for (const [input, expected] of Object.entries(camelCaseTestCases)) {
        assert.equal(
            applyEntityNameCase(input, "camelCase"),
            expected,
            `input: ${JSON.stringify(input)}`,
        );
    }
});
