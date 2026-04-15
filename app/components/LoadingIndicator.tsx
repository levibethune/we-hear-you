"use client";

export function LoadingIndicator({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="flex items-center gap-1.5">
        <div
          className="w-2.5 h-2.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--peach)", animationDelay: "0ms", animationDuration: "0.8s" }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--seafoam)", animationDelay: "150ms", animationDuration: "0.8s" }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--sunshine)", animationDelay: "300ms", animationDuration: "0.8s" }}
        />
      </div>
      {message && (
        <p className="text-sm text-muted">{message}</p>
      )}
    </div>
  );
}
