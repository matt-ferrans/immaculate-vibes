// Bans `it()` blocks whose only `expect(...)` calls are against mocks.
//
// The failure mode this catches: a test that mocks the unit under test
// (or all its collaborators), calls the production function, then asserts
// `expect(someMock).toHaveBeenCalledWith(...)`. The mock setup IS the test
// and IS the assertion — deleting the production code keeps the test
// green. See Freeman & Pryce, "Don't mock what you don't own".
//
// Heuristic: every `it`/`test` block must contain at least one
// `expect(x)` where `x` is not a Mock-shaped identifier (something
// ending in "Mock" or matching vi.fn()/vi.mocked()/vi.spyOn()).

const TEST_BLOCK_NAMES = new Set(["it", "test"]);
const MOCK_MEMBER_RE = /Mock$/;

function isMockExpression(node) {
  if (!node) {
    return false;
  }
  // Identifier ending in "Mock": `someThingMock`
  if (node.type === "Identifier" && MOCK_MEMBER_RE.test(node.name)) {
    return true;
  }
  // vi.fn(), vi.mocked(), vi.spyOn()
  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "vi" &&
    node.callee.property.type === "Identifier" &&
    ["fn", "mocked", "spyOn"].includes(node.callee.property.name)
  ) {
    return true;
  }
  // vi.mocked(x) wrapper: vi.mocked(...).toHaveBeenCalled — caught above
  // mock.calls / mock.results member access — caught via parent expression
  if (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    MOCK_MEMBER_RE.test(node.object.name)
  ) {
    return true;
  }
  return false;
}

function isMockOnlyAssertionChain(callExpr) {
  // callExpr is `expect(X)`
  const [arg] = callExpr.arguments;
  if (!arg) {
    return false;
  }
  return isMockExpression(arg);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Every it()/test() block must contain at least one expect() against a non-mock value — observable state, return value, or thrown error.",
    },
    schema: [],
    messages: {
      mockOnly:
        "This {{kind}}() only asserts against mocks. Add at least one expect() against observable state (DB row, return value, thrown error, rendered HTML). See docs/testing-obligations.md → 'Mock theater'.",
    },
  },
  create(context) {
    const blockStack = [];

    function enterBlock(kind, node) {
      blockStack.push({ kind, node, expectCount: 0, nonMockExpectCount: 0 });
    }

    function exitBlock() {
      const frame = blockStack.pop();
      if (!frame) {
        return;
      }
      if (frame.expectCount === 0) {
        // No expects at all — let other rules handle "test with no assertions".
        return;
      }
      if (frame.nonMockExpectCount === 0) {
        context.report({
          node: frame.node,
          messageId: "mockOnly",
          data: { kind: frame.kind },
        });
      }
    }

    return {
      CallExpression(node) {
        // Track entering an it()/test() block
        if (node.callee.type === "Identifier" && TEST_BLOCK_NAMES.has(node.callee.name)) {
          enterBlock(node.callee.name, node);
          return;
        }
        // it.skip / it.fails etc — same effect
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          TEST_BLOCK_NAMES.has(node.callee.object.name)
        ) {
          enterBlock(node.callee.object.name, node);
          return;
        }
        // Count expect() calls inside the current block
        const frame = blockStack[blockStack.length - 1];
        if (!frame) {
          return;
        }
        if (node.callee.type === "Identifier" && node.callee.name === "expect") {
          frame.expectCount += 1;
          if (!isMockOnlyAssertionChain(node)) {
            frame.nonMockExpectCount += 1;
          }
        }
      },
      "CallExpression:exit"(node) {
        if (node.callee.type === "Identifier" && TEST_BLOCK_NAMES.has(node.callee.name)) {
          exitBlock();
          return;
        }
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          TEST_BLOCK_NAMES.has(node.callee.object.name)
        ) {
          exitBlock();
        }
      },
    };
  },
};
