// Bans Playwright specs whose only assertions are heading visibility.
//
// "Navigate to a route, assert the h1 is visible, done" is not an e2e
// test — it's a liveness probe dressed up as one. Real e2e specs
// submit forms, change DB state, navigate via real UI links, and
// assert on the resulting page state. See docs/testing-obligations.md
// → "Critical User Journey e2e".
//
// Heuristic: each `test(...)` block in e2e/ must contain at least one
// assertion that is NOT `expect(headingLocator).toBeVisible()`. A
// heading-only spec is the failure mode this catches.

const TEST_BLOCK_NAMES = new Set(["test", "it"]);

function calleeName(callee) {
  if (callee.type === "Identifier") {
    return callee.name;
  }
  if (callee.type === "MemberExpression" && callee.object.type === "Identifier") {
    return callee.object.name;
  }
  return null;
}

// `expect(page.getByRole("heading", ...))` or `expect(page.locator("h1"))`
function isHeadingLocator(arg) {
  if (!arg || arg.type !== "CallExpression") {
    return false;
  }
  // page.getByRole("heading", ...)
  if (
    arg.callee.type === "MemberExpression" &&
    arg.callee.property.type === "Identifier"
  ) {
    const method = arg.callee.property.name;
    if (method === "getByRole") {
      const [role] = arg.arguments;
      if (role && role.type === "Literal" && role.value === "heading") {
        return true;
      }
    }
    if (method === "locator") {
      const [sel] = arg.arguments;
      if (
        sel &&
        sel.type === "Literal" &&
        typeof sel.value === "string" &&
        /^h[1-6]$/i.test(sel.value.trim())
      ) {
        return true;
      }
    }
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "e2e specs must do more than navigate + assert heading visibility. Submit forms, mutate state, assert resulting content.",
    },
    schema: [],
    messages: {
      navOnly:
        "This e2e test only asserts heading visibility. Add a behavior assertion: form submission, navigation result, DB state change, or non-heading content match. See docs/testing-obligations.md → 'Critical User Journey e2e'.",
    },
  },
  create(context) {
    const stack = [];

    function enter(node, kind) {
      stack.push({ node, kind, expectCount: 0, behavioralExpectCount: 0 });
    }

    function exit() {
      const frame = stack.pop();
      if (!frame || frame.expectCount === 0) {
        return;
      }
      if (frame.behavioralExpectCount === 0) {
        context.report({ node: frame.node, messageId: "navOnly" });
      }
    }

    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (name && TEST_BLOCK_NAMES.has(name)) {
          enter(node, name);
          return;
        }
        const frame = stack[stack.length - 1];
        if (!frame) {
          return;
        }
        if (node.callee.type === "Identifier" && node.callee.name === "expect") {
          frame.expectCount += 1;
          if (!isHeadingLocator(node.arguments[0])) {
            frame.behavioralExpectCount += 1;
          }
        }
      },
      "CallExpression:exit"(node) {
        const name = calleeName(node.callee);
        if (name && TEST_BLOCK_NAMES.has(name)) {
          exit();
        }
      },
    };
  },
};
