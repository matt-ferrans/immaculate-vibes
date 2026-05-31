// IV gate: coderabbit (pure evaluator).
//
// Pure evaluation logic for the CodeRabbit gate, split from any `gh` /
// network I/O so it can be driven with fixture data and unit-tested.
// Inputs: the shapes of the GitHub REST/GraphQL responses we care about.
// Output: a Verdict the CLI renders into stdout + an exit code.
//
// Lifted verbatim (logic-wise) from Anser-Portal's
// scripts/dev/coderabbit-gate-evaluate.ts. The GitHub-fetching wrapper
// (coderabbit-gate.ts) that calls `gh api` and feeds this evaluator is a
// later slice — it's the non-portable, network-bound half.
//
// The gate enforces two things:
//   1. Every actionable CodeRabbit inline comment is resolved-as-thread
//      or has a non-bot reply.
//   2. The "fresh-agent" rule: a CodeRabbit finding must not be addressed
//      by the same Claude session (identified by a commit-message session
//      trailer) that wrote the reviewed code.

export const SESSION_TRAILER = /https:\/\/claude\.ai\/code\/(session_[A-Za-z0-9]+)/g;
export const SKIP_MARKER = "[skip coderabbit-gate]";
const CODERABBIT_LOGIN = "coderabbitai";

export function sessionIdsIn(message) {
  const ids = [];
  for (const m of message.matchAll(SESSION_TRAILER)) ids.push(m[1]);
  return ids;
}

export function isCoderabbit(login) {
  // GitHub appends `[bot]` to App logins in some responses but not others;
  // match both forms case-insensitively.
  if (!login) return false;
  const lower = login.toLowerCase();
  return lower === CODERABBIT_LOGIN || lower === `${CODERABBIT_LOGIN}[bot]`;
}

export function evaluate({ title, inlineComments, reviews, issueComments, threads, commits }) {
  if (title.includes(SKIP_MARKER)) {
    return { status: "skip", reason: `PR title contains ${SKIP_MARKER} — gate explicitly waived.` };
  }

  // Has CodeRabbit reviewed at all? Three signals: an inline comment, a
  // submitted review, or an issue-level comment (e.g. the "No actionable
  // comments 🎉" status).
  const coderabbitHasReviewed =
    inlineComments.some((c) => isCoderabbit(c.user?.login)) ||
    reviews.some((r) => isCoderabbit(r.user?.login) && r.submitted_at !== null) ||
    issueComments.some((c) => isCoderabbit(c.user?.login));

  if (!coderabbitHasReviewed) {
    return {
      status: "pending",
      reason:
        "Waiting on CodeRabbit's first review. The gate stays red until CodeRabbit posts. Use [skip coderabbit-gate] in the PR title only if this PR is genuinely exempt.",
    };
  }

  const crComments = inlineComments.filter((c) => isCoderabbit(c.user?.login));
  if (crComments.length === 0) {
    return { status: "clean", reason: "No actionable CodeRabbit comments." };
  }

  // A thread is "satisfied" when resolved OR a non-bot reply was posted.
  const threadByCommentId = new Map();
  for (const t of threads) {
    for (const c of t.comments.nodes) {
      threadByCommentId.set(c.databaseId, t);
    }
  }
  const repliesByParent = new Map();
  for (const c of inlineComments) {
    if (c.in_reply_to_id) {
      const arr = repliesByParent.get(c.in_reply_to_id) ?? [];
      arr.push(c);
      repliesByParent.set(c.in_reply_to_id, arr);
    }
  }

  const unresolved = [];
  for (const c of crComments) {
    if (c.in_reply_to_id) continue; // CodeRabbit's own replies aren't new findings
    const thread = threadByCommentId.get(c.id);
    if (thread?.isResolved) continue;
    if (thread?.isOutdated) continue; // diff moved on; treat as satisfied
    const replies = repliesByParent.get(c.id) ?? [];
    if (replies.find((r) => !isCoderabbit(r.user?.login))) continue;
    unresolved.push({ path: c.path, line: c.line ?? c.original_line, url: c.html_url });
  }

  if (unresolved.length > 0) {
    return {
      status: "unresolved",
      reason: `${unresolved.length} CodeRabbit comment(s) have no reply and no thread resolution.`,
      comments: unresolved,
    };
  }

  // Fresh-agent check: for each comment, compare session-id trailers on
  // commits AFTER the comment against trailers on commits AT/BEFORE it. Any
  // overlap = the same session that wrote the code is addressing its
  // critique. Trailer-less commits are treated as human and exempt.
  const violations = [];
  for (const c of crComments) {
    if (c.in_reply_to_id) continue;
    const commentAt = new Date(c.created_at).getTime();
    const before = [];
    const after = [];
    for (const commit of commits) {
      const ts = new Date(commit.committedDate).getTime();
      const ids = sessionIdsIn(commit.message);
      if (ts <= commentAt) before.push(...ids);
      else after.push({ oid: commit.oid, ids });
    }
    const beforeSet = new Set(before);
    for (const fix of after) {
      for (const id of fix.ids) {
        if (beforeSet.has(id)) {
          const existing = violations.find(
            (v) => v.sessionId === id && v.commentUrl === c.html_url,
          );
          if (existing) existing.commits.push(fix.oid.slice(0, 12));
          else violations.push({ sessionId: id, commits: [fix.oid.slice(0, 12)], commentUrl: c.html_url });
        }
      }
    }
  }

  if (violations.length > 0) {
    return {
      status: "fresh-agent",
      reason: `${violations.length} CodeRabbit comment(s) were addressed by the same session that wrote the reviewed code. A fresh subagent must triage CodeRabbit feedback.`,
      violations,
    };
  }

  return { status: "clean", reason: `All ${crComments.length} CodeRabbit comment(s) addressed.` };
}

export function render(verdict) {
  const lines = [];
  switch (verdict.status) {
    case "clean":
    case "skip":
      lines.push(`coderabbit-gate: PASS — ${verdict.reason}`);
      break;
    case "pending":
      lines.push(`coderabbit-gate: PENDING — ${verdict.reason}`);
      break;
    case "unresolved":
      lines.push(`coderabbit-gate: FAIL — ${verdict.reason}`, "", "Unaddressed CodeRabbit comments:");
      for (const c of verdict.comments) lines.push(`  - ${c.path}:${c.line ?? "?"} → ${c.url}`);
      lines.push("", "Address each by replying on the thread with a justification, or pushing a fix. Triage MUST be done by a fresh subagent — not the agent that opened the PR.");
      break;
    case "fresh-agent":
      lines.push(`coderabbit-gate: FAIL — ${verdict.reason}`, "", "Same-session commits detected:");
      for (const v of verdict.violations) lines.push(`  - ${v.sessionId} addressed ${v.commentUrl} via ${v.commits.join(", ")}`);
      lines.push("", "Spawn a fresh subagent (different session) to apply or decline the finding.");
      break;
    case "error":
      lines.push(`coderabbit-gate: ERROR — ${verdict.reason}`);
      break;
  }
  return lines.join("\n");
}

export function exitCode(verdict) {
  switch (verdict.status) {
    case "clean":
    case "skip":
      return 0;
    case "unresolved":
    case "fresh-agent":
      return 1;
    case "pending":
      return 2;
    case "error":
      return 3;
  }
}

export default evaluate;
