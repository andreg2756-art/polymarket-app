"use client";

interface Props {
  onRetry?: () => void;
  message?: string;
}

export default function ErrorState({ onRetry, message }: Props) {
  return (
    <div className="rounded-xl border border-red-900 bg-red-950/30 py-12 text-center space-y-3">
      <p className="text-red-400 text-sm">{message ?? "Could not load data. Check your connection and try again."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
