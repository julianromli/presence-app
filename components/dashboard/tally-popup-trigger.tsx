import { Button } from '@/components/ui/button';
import { ChatCircleDots } from '@phosphor-icons/react/dist/ssr';

const TALLY_FORM_ID = 'eqEK6E';

export function TallyPopupTrigger() {
  return (
    <Button
      aria-label="Buka Form Tally"
      className="fixed bottom-20 right-4 z-50 rounded-full border-zinc-950 bg-zinc-950 text-white shadow-lg shadow-zinc-950/30 hover:bg-zinc-800 hover:text-white md:bottom-6 md:right-6"
      data-tally-open={TALLY_FORM_ID}
      data-tally-hide-title="1"
      data-tally-emoji-text="👋"
      data-tally-emoji-animation="tada"
      data-tally-auto-close="0"
      size="icon-lg"
      title="Buka Form Tally"
      variant="outline"
    >
      <ChatCircleDots weight="fill" />
    </Button>
  );
}
