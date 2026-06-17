import { useMobileNavigation } from '@/hooks/useMobileNavigation';
import { EmailList } from '@/components/mail/EmailList';
import { EmailView } from '@/components/mail/EmailView';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mail',
  component: MailLayout,
});

function MailLayout() {
  const { isMobile } = useMobileNavigation();
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      {/* List View - Full width on mobile when no message selected */}
      <div className={`flex flex-col border-r ${isMobile && selectedMessage ? 'hidden' : 'flex-1 md:w-96'}`}>
        <EmailList onSelect={(id) => setSelectedMessage(id)} />
      </div>

      {/* Reader View */}
      <div className={`flex-1 overflow-auto ${isMobile && !selectedMessage ? 'hidden' : 'block'}`}>
        <EmailView messageId={selectedMessage} onClose={() => setSelectedMessage(null)} />
      </div>
    </div>
  );
}
