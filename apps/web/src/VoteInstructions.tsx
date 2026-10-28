import type { ForgeCategoryState, Provider } from "@bossforge/shared";
import { humanizeVoteChoice, voteCommand } from "@bossforge/shared";

export function VoteInstructions({
  category,
  mode,
  connectedToTwitch,
  surface,
}: {
  category: ForgeCategoryState | null;
  mode: Provider;
  connectedToTwitch: boolean;
  surface: "dashboard" | "overlay";
}) {
  if (!category || category.status !== "open") return null;

  const live = mode === "twitch" && connectedToTwitch;
  const disconnected = mode === "twitch" && !connectedToTwitch;
  return (
    <div className={`vote-instructions ${surface}`} aria-label="Current vote instructions">
      {live ? (
        <p>
          Vote in Twitch chat: <code>!vote {category.category} &lt;choice&gt;</code>
        </p>
      ) : disconnected ? (
        <p role="status">Twitch disconnected · live voting is paused.</p>
      ) : (
        <p>SIMULATED · Twitch is not connected. Use Generate event in the dashboard to preview.</p>
      )}
      <div className="vote-command-list">
        {category.options.map((option) => (
          <span key={option.choice}>
            <strong>{humanizeVoteChoice(option.choice)}</strong>
            {live && <code>{voteCommand(category.category, option.choice)}</code>}
          </span>
        ))}
      </div>
    </div>
  );
}
