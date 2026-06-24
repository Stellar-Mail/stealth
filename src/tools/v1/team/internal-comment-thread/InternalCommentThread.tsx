import React, { useState, useRef, useEffect } from "react";

type ThreadState = "idle" | "loading" | "success" | "error" | "empty";

interface Comment {
  id: string;
  author: string;
  avatarUrl?: string;
  role: string;
  content: string;
  timestamp: string;
}

const initialComments: Comment[] = [
  {
    id: "c1",
    author: "Sarah Jenkins",
    role: "Lead Designer",
    content:
      "The client requested to update the main dashboard hero banner. We should change the copy to match the latest branding guidelines.",
    timestamp: "2 hours ago",
  },
  {
    id: "c2",
    author: "David Chen",
    role: "Fullstack Dev",
    content:
      "Got it. I will draft a PR with the copy updates and pull the asset updates from Figma.",
    timestamp: "1 hour ago",
  },
];

export const InternalCommentThread: React.FC = () => {
  const [state, setState] = useState<ThreadState>("idle");
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const commentListRef = useRef<HTMLUListElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Simulate potential posting error for demonstration
    if (newComment.toLowerCase().includes("simulate error")) {
      setErrorMsg("Network error: Failed to post comment. Please try again.");
      setState("error");
      return;
    }

    const commentToAdd: Comment = {
      id: `c_${Date.now()}`,
      author: "You (Current User)",
      role: "Team Member",
      content: newComment.trim(),
      timestamp: "Just now",
    };

    setComments((prev) => [...prev, commentToAdd]);
    setNewComment("");
    setState("success");

    // Scroll to new comment and focus it for accessibility/screen readers
    setTimeout(() => {
      if (commentListRef.current) {
        const lastItem = commentListRef.current.lastElementChild as HTMLElement;
        if (lastItem) {
          lastItem.scrollIntoView({ behavior: "smooth" });
          lastItem.focus();
        }
      }
    }, 100);
  };

  const handleLoadThread = () => {
    setState("loading");
    setTimeout(() => {
      setState("success");
    }, 1000);
  };

  const handleLoadEmpty = () => {
    setState("loading");
    setTimeout(() => {
      setComments([]);
      setState("empty");
    }, 1000);
  };

  const handleReset = () => {
    setComments(initialComments);
    setNewComment("");
    setErrorMsg(null);
    setState("idle");
  };

  return (
    <div
      className="p-6 border border-gray-200 rounded-xl max-w-2xl mx-auto bg-white shadow-sm"
      role="region"
      aria-labelledby="comment-thread-title"
    >
      <header className="mb-6 border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800" id="comment-thread-title">
            Internal Comment Thread
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Collaborate internally on this mail thread.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
          aria-label="Reset tool view state"
        >
          Reset View
        </button>
      </header>

      {/* Simulator Control Panel (For Review/Verification purposes) */}
      <div
        className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap gap-2 items-center"
        role="group"
        aria-label="Demo State Controller"
      >
        <span className="text-xs font-semibold text-gray-600 mr-2">Demo States:</span>
        <button
          onClick={handleLoadThread}
          className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-pressed={state === "loading" || state === "success"}
        >
          Simulate Load Comments
        </button>
        <button
          onClick={handleLoadEmpty}
          className="text-xs px-3 py-1 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
          aria-pressed={state === "empty"}
        >
          Simulate Empty State
        </button>
        <button
          onClick={() => {
            setErrorMsg("System warning: Connection timeout while fetching thread comments.");
            setState("error");
          }}
          className="text-xs px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-pressed={state === "error"}
        >
          Simulate Error
        </button>
      </div>

      {/* Live region for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[200px] flex flex-col justify-between"
      >
        {state === "idle" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-gray-500">Comments are currently hidden.</p>
            <button
              onClick={handleLoadThread}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Load Comments ({comments.length})
            </button>
          </div>
        )}

        {state === "loading" && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            aria-busy="true"
            aria-label="Loading comments"
          >
            <div
              className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"
              role="presentation"
            ></div>
            <p className="text-sm text-gray-500 font-medium">
              Fetching internal thread discussion...
            </p>
          </div>
        )}

        {state === "empty" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-xl" role="img" aria-hidden="true">
                💬
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">No comments yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Be the first to share notes or internal tasks with your team on this thread.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4" role="alert">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-500 text-lg" aria-hidden="true">
                  ⚠️
                </span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-semibold text-red-800">Thread loading issue</h3>
                <p className="text-xs text-red-700 mt-1">
                  {errorMsg || "An unknown error occurred."}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleLoadThread}
                    className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    Retry Connection
                  </button>
                  <button
                    onClick={() => {
                      setState("idle");
                      setErrorMsg(null);
                    }}
                    className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(state === "success" || state === "empty" || state === "error") && (
          <>
            {comments.length > 0 && (
              <ul
                ref={commentListRef}
                className="space-y-4 max-h-[300px] overflow-y-auto pr-1 mb-4"
                aria-label="Discussion comments"
              >
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-gray-100 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 outline-none transition-all"
                    tabIndex={0}
                    aria-label={`Comment by ${comment.author}, ${comment.role}, posted ${comment.timestamp}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-semibold text-sm text-gray-800">
                          {comment.author}
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded-full ml-2">
                          {comment.role}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">{comment.timestamp}</span>
                    </div>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap mt-1">
                      {comment.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {/* Comment Form */}
            <form onSubmit={handlePostComment} className="border-t pt-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="new-comment-textarea"
                  className="text-xs font-semibold text-gray-700"
                >
                  Add Internal Note
                </label>
                <textarea
                  id="new-comment-textarea"
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type an internal comment... (type 'simulate error' to test validation)"
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                  aria-required="true"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-gray-500" id="textarea-desc">
                    Visible only to teammates.
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                    disabled={!newComment.trim()}
                  >
                    Post Note
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
