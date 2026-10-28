import type { ReactNode } from "react";

export function LiveVoteSurface({
  children,
  connection,
  snapshotAvailable,
  surface,
}: {
  children: ReactNode;
  connection: string;
  snapshotAvailable: boolean;
  surface: "dashboard" | "overlay";
}) {
  if (connection !== "connected")
    return (
      <section
        className={`live-vote-unavailable ${surface}`}
        aria-label={`${surface} vote status`}
        role="status"
      >
        <strong>SERVER LINK UNAVAILABLE</strong>
        <span>LIVE VOTE STATUS UNKNOWN</span>
      </section>
    );

  if (!snapshotAvailable)
    return (
      <section
        className={`live-vote-unavailable ${surface}`}
        aria-label={`${surface} vote status`}
        role="status"
      >
        <strong>WAITING FOR FRESH SERVER STATE</strong>
        <span>LIVE VOTE STATUS UNKNOWN</span>
      </section>
    );

  return <div className={`live-vote-current ${surface}`}>{children}</div>;
}
