// Bans `vi.mock("@/lib/session", ...)` in src/__tests__/actions/**.
//
// Stubbing the auth layer deletes the very boundary the action exists to
// defend — if `requireInternalSession()` is replaced with a hard-coded
// return value, the test passes even if the action drops its auth check
// entirely. Use a real JWT + real cookie via the testSession() helper
// instead. See docs/testing-obligations.md → "Auth is not mockable".
//
// Grandfathered files use `// eslint-disable-next-line
// anser-test/no-session-mock-in-actions -- TODO(test-quality): ...` so
// the backlog is greppable.
//
// IV note: the targeted module list is Anser-specific. A later phase
// parameterizes it via rule options so a consuming repo can name its own
// session module(s). Lifted verbatim for now so the extraction is auditable.

const TARGETED_MODULES = new Set(["@/lib/session", "@/lib/auth/session", "@/lib/auth"]);

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow vi.mock() of the session/auth module in action tests — stubbing the auth boundary defeats the point of the test.",
    },
    schema: [],
    messages: {
      noSessionMock:
        "Do not vi.mock({{module}}) in action tests. The auth gate is what the action exists to defend; stubbing it deletes the test's value. Use the real testSession() helper (see docs/testing-obligations.md).",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.object.type !== "Identifier" ||
          node.callee.object.name !== "vi" ||
          node.callee.property.type !== "Identifier" ||
          node.callee.property.name !== "mock"
        ) {
          return;
        }
        const [arg] = node.arguments;
        if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") {
          return;
        }
        if (TARGETED_MODULES.has(arg.value)) {
          context.report({
            node,
            messageId: "noSessionMock",
            data: { module: JSON.stringify(arg.value) },
          });
        }
      },
    };
  },
};
